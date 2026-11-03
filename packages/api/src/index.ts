import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, and, ne, isNotNull, desc } from 'drizzle-orm';
import {
  COUNTRIES,
  LOCALES,
  getCountry,
  defaultLocale,
  parsePath,
  recipePath,
  recipePathFor,
  countryPath,
  slugify,
  validateRecipeSubmission,
  type RecipePage,
} from '@2yolks/contracts';
import { renderHome, renderCountryHome, renderRecipe, renderAbout, renderPrivacy, renderHowWeTest, renderNotFound } from '@2yolks/web/server';
import { isUntested } from '@2yolks/contracts';
import { createDb, recipes, recipeLocales, recipeImages, sources } from './db';
import { mcpApp } from './mcp';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** R2 bucket for rights-tracked recipe images (migration 0004). */
  IMAGES?: R2Bucket;
  /** 'true' only in local dev (wrangler dev --var ALLOW_DEMO_SEED:true).
   * Synthetic demo-seed content must never be served in production. */
  ALLOW_DEMO_SEED?: string;
  /** 'true' opens the submission draft endpoint. Stays false until auth
   * (Better Auth + Turnstile per plan) qualifies on Workers Free CPU. */
  SUBMISSIONS_ENABLED?: string;
  /** Pinned canonical origin for absolute URLs (hreflang, JSON-LD).
   * Never derive from the request Host header. */
  CANONICAL_ORIGIN?: string;
  /** Admin MCP bearer (shared directory admin key). Unset = MCP closed (503). */
  ADMIN_MCP_API_KEY?: string;
  /** Optional read-only MCP bearer. */
  MCP_READ_KEY?: string;
  /** Optional JSON array of per-agent keys: [{"name","key","role"}]. */
  MCP_NAMED_KEYS?: string;
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

// Additive: `countries` and `locales` keep their full-catalogue shape.
// `published` lists, per country, the locales that currently have at least
// one published recipe, so clients can tell supported from available.
app.get('/api/v1/countries', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ country: recipeLocales.country, lang: recipeLocales.lang })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, demoAllowed(c)));
  const pub: Record<string, string[]> = {};
  for (const r of rows) {
    const list = (pub[r.country] ??= []);
    if (!list.includes(r.lang)) list.push(r.lang);
  }
  for (const list of Object.values(pub)) list.sort();
  return c.json({ countries: COUNTRIES, locales: LOCALES, published: pub });
});

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
          `    <xhtml:link rel="alternate" hreflang="${xmlEscape(`${a.lang}-${a.country.toUpperCase()}`)}" href="${xmlEscape(origin + recipePathFor(a.country, a.lang, a.recipeId, a.slug))}" />`,
      )
      .join('\n');
    for (const r of list) {
      urls.push(
        `  <url>\n    <loc>${xmlEscape(origin + recipePathFor(r.country, r.lang, r.recipeId, r.slug))}</loc>\n${links}\n  </url>`,
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

// --- Recipe images (migration 0004) ------------------------------------------
// Registered before the /:country catch-alls so they cannot shadow it.
// Serves rights-tracked R2 images by their recipe_images row id. Two gates,
// both mandatory: the image row itself must be rights-cleared (cleared_at -
// recorded provenance alone is NOT clearance) AND the recipe must have at
// least one published, rights-cleared locale (same visibility rule as the
// recipe page). No arbitrary R2 keys: only rows recorded through
// recipes.set_image are served. Plain 404s (never the HTML/ASSETS not-found
// path): this is a binary endpoint.
app.get('/img/recipe/:imageId', async (c) => {
  // 404s are never cached: a visibility flip must not stick at the edge.
  const notFound = () => c.text('not found', 404, { 'cache-control': 'no-store' });
  const images = c.env.IMAGES;
  if (!images) return notFound();
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ r2Key: recipeImages.r2Key, mime: recipeImages.mime, recipeId: recipeImages.recipeId, clearedAt: recipeImages.clearedAt })
    .from(recipeImages)
    .where(eq(recipeImages.id, c.req.param('imageId')))
    .limit(1);
  const img = rows[0];
  if (!img || !img.clearedAt) return notFound();
  const visible = await db
    .select({ slug: recipeLocales.slug })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(eq(recipeLocales.recipeId, img.recipeId), published(db, demoAllowed(c))))
    .limit(1);
  if (visible.length === 0) return notFound();
  const obj = await images.get(img.r2Key);
  if (!obj) return notFound();
  return new Response(obj.body, {
    headers: {
      'content-type': img.mime,
      // Content for an image id never changes (a new upload is a new id), but
      // visibility flips with publish state - an immutable year-long cache
      // would keep serving unpublished images. max-age=300 bounds staleness
      // to 5 minutes, matching the draft/private visibility promise.
      'cache-control': 'public, max-age=300',
      // Defense in depth for the container-validation bound (JPEG/WebP
      // bitstream corruption is not detected): the browser must treat the
      // bytes strictly as the declared image type, never sniffed as active
      // content.
      'x-content-type-options': 'nosniff',
    },
  });
});

// --- SSR pages ----------------------------------------------------------

app.get('/', async (c) => {
  // Default locales are always listed (unchanged behavior); additional
  // locales appear only once they have published content, so registering a
  // locale in LOCALES alone never exposes it on the homepage.
  const db = createDb(c.env.DB);
  const live = await db
    .selectDistinct({ country: recipeLocales.country, lang: recipeLocales.lang })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, demoAllowed(c)));
  const markets = COUNTRIES.filter((ct) => ct.wave === 1).flatMap((ct) =>
    (LOCALES[ct.code] ?? [])
      .filter((lang) => lang === defaultLocale(ct.code) || live.some((l) => l.country === ct.code && l.lang === lang))
      .map((lang) => ({ country: ct.code, countryName: ct.name, lang })),
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
app.get('/privacy', (c) => c.html(renderPrivacy()));
app.get('/how-we-test', (c) => c.html(renderHowWeTest()));
app.get('/:country', countryHome);
app.get('/:country/', countryHome);

const recipeRoute = async (c: Context<{ Bindings: Bindings }>) => {
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
        eq(recipeLocales.lang, parsed.lang ?? defaultLocale(parsed.country) ?? ''),
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
      recipePathFor(parsed.country, target.recipe_locales.lang, parsed.id, target.recipe_locales.slug),
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
    href: `${origin}${recipePathFor(a.country, a.lang, parsed.id ?? '', a.slug)}`,
  }));
  // x-default points at the default-locale version when one exists.
  const def = alternatesRows.find((a) => a.country === parsed.country && a.lang === defaultLang);
  if (def) {
    alternates.push({
      hreflang: 'x-default',
      href: `${origin}${recipePathFor(def.country, def.lang, parsed.id ?? '', def.slug)}`,
    });
  }

  // Latest rights-cleared hero image, if any (migration 0004). The page
  // renderer falls back to the title graphic when this is null. Uncleared
  // rows (recorded provenance without the rightsConfirmed stamp) never reach
  // the page.
  const heroRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, parsed.id), eq(recipeImages.kind, 'hero'), isNotNull(recipeImages.clearedAt)))
    .orderBy(desc(recipeImages.createdAt))
    .limit(1);
  // Cleared step images, latest first so the newest row per step wins.
  const stepRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style, stepIndex: recipeImages.stepIndex })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, parsed.id), eq(recipeImages.kind, 'step'), isNotNull(recipeImages.clearedAt)))
    .orderBy(desc(recipeImages.createdAt));
  // Aligned to the page locale's steps array by 0-based index; steps without
  // an image stay null.
  let stepCount = 0;
  try {
    const stepsParsed: unknown = JSON.parse(canonical.recipe_locales.stepsJson);
    stepCount = Array.isArray(stepsParsed) ? stepsParsed.length : 0;
  } catch {
    stepCount = 0;
  }
  const stepImages: NonNullable<RecipePage['stepImages']> = Array.from({ length: stepCount }, () => null);
  for (const row of stepRows) {
    const idx = row.stepIndex ?? -1;
    if (idx < 0 || idx >= stepCount || stepImages[idx]) continue;
    stepImages[idx] = { url: `${origin}/img/recipe/${row.id}`, style: row.style };
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
      prepMinutes: canonical.recipes.prepMinutes,
      cookMinutes: canonical.recipes.cookMinutes,
      restMinutes: canonical.recipes.restMinutes,
      totalMinutes: canonical.recipes.totalMinutes,
      baseServings: canonical.recipes.baseServings,
      category: (canonical.recipes.category ?? null) as RecipePage['recipe']['category'],
    },
    heroImage: heroRows[0] ? { url: `${origin}/img/recipe/${heroRows[0].id}`, style: heroRows[0].style } : null,
    stepImages,
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
      translationOf: canonical.recipe_locales.translationOf,
      translationMethod: canonical.recipe_locales.translationMethod,
      translationReviewedAt: canonical.recipe_locales.translationReviewedAt,
      translationReviewedBy: canonical.recipe_locales.translationReviewedBy,
      translationReviewerKind: canonical.recipe_locales.translationReviewerKind,
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
};
app.get('/:country/recipes/:idSlug', recipeRoute);
app.get('/:country/:lang/recipes/:idSlug', recipeRoute);

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
      translationOf: l.translationOf ?? null,
      translationMethod: l.translationMethod ?? null,
    })),
  );
  return c.json({ id, status: 'draft' }, 201);
});

// --- Admin MCP (agent content tools) -----------------------------------------
// Fail-closed: with no keys configured the mount answers 503. See mcp.ts.
app.route('/api/admin/mcp', mcpApp);

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
