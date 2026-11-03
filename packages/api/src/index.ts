import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, and, ne, isNotNull } from 'drizzle-orm';
import {
  COUNTRIES,
  LOCALES,
  getCountry,
  defaultLocale,
  parsePath,
  recipePath,
  countryPath,
  slugify,
  validateRecipeSubmission,
  type RecipePage,
} from '@2yolks/contracts';
import { renderHome, renderCountryHome, renderRecipe, renderAbout, renderHowWeTest, renderNotFound } from '@2yolks/web/server';
import { isUntested } from '@2yolks/contracts';
import { createDb, recipes, recipeLocales, sources } from './db';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** 'true' only in local dev (wrangler dev --var ALLOW_DEMO_SEED:true).
   * Synthetic demo-seed content must never be served in production. */
  ALLOW_DEMO_SEED?: string;
  /** 'true' opens the submission draft endpoint. Stays false until auth
   * (Better Auth + Turnstile per plan) qualifies on Workers Free CPU. */
  SUBMISSIONS_ENABLED?: string;
  /** Pinned canonical origin for absolute URLs (hreflang, JSON-LD).
   * Never derive from the request Host header. */
  CANONICAL_ORIGIN?: string;
};

const DEMO_LICENSE = 'internal-demo';

const app = new Hono<{ Bindings: Bindings }>();

/** Published-row predicate: requires a cleared source (license reviewed),
 * and excludes synthetic demo-seed rows unless ALLOW_DEMO_SEED=true
 * (local dev only). This is a production serving gate, not noindex. */
function published(db: ReturnType<typeof createDb>, allowDemo: boolean) {
  const conds = [
    eq(recipeLocales.status, 'published'),
    // clearedAt NULL means the source rights review has not completed.
    isNotNull(sources.clearedAt),
  ];
  if (!allowDemo) conds.push(ne(sources.license, DEMO_LICENSE));
  return and(...conds);
}

const demoAllowed = (c: Context<{ Bindings: Bindings }>) => c.env.ALLOW_DEMO_SEED === 'true';

// --- API ---------------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/v1/countries', (c) =>
  c.json({ countries: COUNTRIES, locales: LOCALES }),
);

app.get('/api/v1/countries/:code/recipes', async (c) => {
  const country = getCountry(c.req.param('code'));
  if (!country) return c.json({ error: 'unknown country' }, 404);
  const requested = c.req.query('lang');
  const lang = requested ?? defaultLocale(country.code);
  if (!lang || (requested && !(LOCALES[country.code] ?? []).includes(requested))) {
    return c.json({ error: 'unsupported locale', country: country.code, locales: LOCALES[country.code] ?? [] }, 404);
  }
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      slug: recipeLocales.slug,
      title: recipeLocales.title,
      lang: recipeLocales.lang,
      id: recipeLocales.recipeId,
    })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(
      and(
        eq(recipeLocales.country, country.code),
        eq(recipeLocales.lang, lang ?? ''),
        published(db, demoAllowed(c)),
      ),
    );
  return c.json({ country: country.code, lang, recipes: rows });
});

// --- Discovery --------------------------------------------------------------

app.get('/robots.txt', (c) => {
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.text(
    `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
    200,
    { 'content-type': 'text/plain; charset=utf-8' },
  );
});

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.get('/sitemap.xml', async (c) => {
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      recipeId: recipeLocales.recipeId,
      country: recipeLocales.country,
      lang: recipeLocales.lang,
      slug: recipeLocales.slug,
    })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, demoAllowed(c)));
  const urls: string[] = [];
  const byRecipe = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byRecipe.get(r.recipeId) ?? [];
    list.push(r);
    byRecipe.set(r.recipeId, list);
  }
  // Country homes only when they carry at least one published recipe
  // (empty listings are noindex and stay out of the sitemap).
  const countriesWithContent = new Set(rows.map((r) => r.country));
  for (const code of countriesWithContent) {
    urls.push(`  <url><loc>${xmlEscape(origin + countryPath(code))}</loc></url>`);
  }
  for (const list of byRecipe.values()) {
    const links = list
      .map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${xmlEscape(`${a.lang}-${a.country.toUpperCase()}`)}" href="${xmlEscape(origin + recipePath(a.country, a.recipeId, a.slug))}" />`,
      )
      .join('\n');
    for (const r of list) {
      urls.push(
        `  <url>\n    <loc>${xmlEscape(origin + recipePath(r.country, r.recipeId, r.slug))}</loc>\n${links}\n  </url>`,
      );
    }
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    urls.join('\n') +
    `\n</urlset>\n`;
  return c.text(xml, 200, { 'content-type': 'application/xml; charset=utf-8' });
});

// --- SSR pages ----------------------------------------------------------

app.get('/', (c) => {
  const markets = COUNTRIES.filter((ct) => ct.wave === 1).flatMap((ct) =>
    (LOCALES[ct.code] ?? []).map((lang) => ({
      country: ct.code,
      countryName: ct.name,
      lang,
    })),
  );
  return c.html(renderHome({ locales: markets }));
});

const countryHome = async (c: Context<{ Bindings: Bindings }>) => {
  const parsed = parsePath(c.req.path);
  if (!parsed) return c.notFound();
  const country = getCountry(parsed.country);
  // Unscheduled markets (wave 0) are not launched: 404, never an empty 200.
  if (!country || country.wave === 0) return c.notFound();
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ slug: recipeLocales.slug, title: recipeLocales.title, id: recipeLocales.recipeId, lang: recipeLocales.lang, testedAt: recipes.testedAt })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(eq(recipeLocales.country, parsed.country), published(db, demoAllowed(c))));
  return c.html(
    renderCountryHome({
      countryName: country.name,
      country: parsed.country,
      recipes: rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, untested: isUntested({ testedAt: r.testedAt }), lang: r.lang })),
    }),
    // Empty listings must not be indexed (thin-page gate).
    rows.length === 0 ? 200 : 200,
    rows.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
};
app.get('/about', (c) => c.html(renderAbout()));
app.get('/how-we-test', (c) => c.html(renderHowWeTest()));
app.get('/:country', countryHome);
app.get('/:country/', countryHome);

app.get('/:country/recipes/:idSlug', async (c) => {
  const parsed = parsePath(c.req.path);
  if (!parsed?.id || !parsed.slug) return c.notFound();
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(
      and(
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.recipeId, parsed.id),
        published(db, demoAllowed(c)),
      ),
    );
  const canonical = rows.find((r) => r.recipe_locales.slug === parsed.slug);
  if (!canonical) {
    // Stale/wrong slug: 301 only when exactly one visible locale row exists
    // for this recipe+country (no unordered guesses).
    const target = rows.length === 1 ? rows[0] : undefined;
    if (!target) return c.notFound();
    return c.redirect(
      recipePath(parsed.country, parsed.id, target.recipe_locales.slug),
      301,
    );
  }

  // hreflang alternates: exact content equivalents of this same recipe only.
  const alternatesRows = await db
    .select({ country: recipeLocales.country, lang: recipeLocales.lang, slug: recipeLocales.slug })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(eq(recipeLocales.recipeId, parsed.id), published(db, demoAllowed(c))));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const defaultLang = defaultLocale(parsed.country);
  const alternates = alternatesRows.map((a) => ({
    hreflang: `${a.lang}-${a.country.toUpperCase()}`,
    href: `${origin}${recipePath(a.country, parsed.id ?? '', a.slug)}`,
  }));
  // x-default points at the default-locale version when one exists.
  const def = alternatesRows.find((a) => a.country === parsed.country && a.lang === defaultLang);
  if (def) {
    alternates.push({
      hreflang: 'x-default',
      href: `${origin}${recipePath(def.country, parsed.id ?? '', def.slug)}`,
    });
  }

  const page: RecipePage = {
    recipe: {
      id: canonical.recipes.id,
      sourceId: canonical.recipes.sourceId,
      originCountry: canonical.recipes.originCountry,
      imageKey: canonical.recipes.imageKey,
      createdAt: canonical.recipes.createdAt,
      testedAt: canonical.recipes.testedAt,
      testedBy: canonical.recipes.testedBy,
    },
    locale: {
      recipeId: canonical.recipe_locales.recipeId,
      country: canonical.recipe_locales.country,
      lang: canonical.recipe_locales.lang,
      title: canonical.recipe_locales.title,
      slug: canonical.recipe_locales.slug,
      intro: canonical.recipe_locales.intro,
      ingredientsJson: canonical.recipe_locales.ingredientsJson,
      stepsJson: canonical.recipe_locales.stepsJson,
      status: canonical.recipe_locales.status,
    },
    source: {
      id: canonical.sources.id,
      name: canonical.sources.name,
      url: canonical.sources.url,
      license: canonical.sources.license,
      clearedAt: canonical.sources.clearedAt,
      notes: canonical.sources.notes,
    },
  };
  return c.html(renderRecipe(page, alternates));
});

// --- Submission draft path -------------------------------------------------
// Every ingestion path parses through validateRecipeSubmission (fail closed).
// Drafts land with cleared_at NULL on their source, so the serving gates can
// never publish them until a rights review clears the source.

app.post('/api/v1/submissions', async (c) => {
  if (c.env.SUBMISSIONS_ENABLED !== 'true') {
    return c.json({ error: 'submissions closed', reason: 'auth gate not qualified yet' }, 503);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }
  const result = validateRecipeSubmission(body);
  if (!result.ok) return c.json({ error: 'validation failed', failures: result.errors }, 400);
  const sub = result.value;
  const db = createDb(c.env.DB);
  const id = crypto.randomUUID().slice(0, 8).toLowerCase();
  const sourceId = `src-${id}`;
  await db.insert(sources).values({
    id: sourceId,
    name: sub.source.name,
    url: sub.source.url,
    license: sub.source.license,
    clearedAt: null,
    notes: 'submission draft - rights review pending',
  });
  await db.insert(recipes).values({
    id,
    sourceId,
    originCountry: sub.originCountry ?? null,
    imageKey: null,
    createdAt: new Date().toISOString(),
  });
  await db.insert(recipeLocales).values(
    sub.locales.map((l) => ({
      recipeId: id,
      country: l.country,
      lang: l.lang,
      title: l.title,
      slug: l.slug ?? slugify(l.title),
      intro: l.intro ?? null,
      ingredientsJson: JSON.stringify(l.ingredients),
      stepsJson: JSON.stringify(l.steps),
      status: 'draft' as const,
    })),
  );
  return c.json({ id, status: 'draft' }, 201);
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else falls through to static assets (JS/CSS/images), which 404
// when no asset matches.
app.notFound(async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status !== 404) return res;
  if (c.req.path.startsWith('/api/')) return res;
  return c.html(renderNotFound(), 404, { 'x-robots-tag': 'noindex' });
});

export default app;
