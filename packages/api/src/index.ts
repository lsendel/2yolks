import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import {
  COUNTRIES,
  LOCALES,
  getCountry,
  defaultLocale,
  parsePath,
  recipePath,
  type RecipePage,
} from '@2yolks/contracts';
import { renderHome, renderCountryHome, renderRecipe } from '@2yolks/web/server';
import { createDb, recipes, recipeLocales, sources } from './db';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** 'true' only in local dev (wrangler dev --var ALLOW_DEMO_SEED:true).
   * Synthetic demo-seed content must never be served in production. */
  ALLOW_DEMO_SEED?: string;
};

const DEMO_LICENSE = 'internal-demo';

const app = new Hono<{ Bindings: Bindings }>();

/** Published-row predicate. Demo-seed rows are excluded unless
 * ALLOW_DEMO_SEED=true (local dev only) - a production guard, not noindex. */
function published(db: ReturnType<typeof createDb>, allowDemo: boolean) {
  const conds = [eq(recipeLocales.status, 'published')];
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
  const lang = c.req.query('lang') ?? defaultLocale(country.code);
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
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ slug: recipeLocales.slug, title: recipeLocales.title, id: recipeLocales.recipeId })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(eq(recipeLocales.country, parsed.country), published(db, demoAllowed(c))));
  return c.html(
    renderCountryHome({
      countryName: country?.name ?? parsed.country,
      country: parsed.country,
      recipes: rows,
    }),
  );
};
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
  const target = canonical ?? rows[0];
  if (!canonical) {
    // Slug changed after freeze: redirect to the canonical slug (301).
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
  const origin = new URL(c.req.url).origin;
  const alternates = alternatesRows.map((a) => ({
    hreflang: `${a.lang}-${a.country.toUpperCase()}`,
    href: `${origin}${recipePath(a.country, parsed.id ?? '', a.slug)}`,
  }));

  const page: RecipePage = {
    recipe: {
      id: canonical.recipes.id,
      sourceId: canonical.recipes.sourceId,
      originCountry: canonical.recipes.originCountry,
      imageKey: canonical.recipes.imageKey,
      createdAt: canonical.recipes.createdAt,
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

// Everything else falls through to static assets (JS/CSS/images), which 404
// when no asset matches.
app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
