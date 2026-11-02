import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import {
  COUNTRIES,
  LOCALES,
  getCountry,
  defaultLocale,
  parsePath,
  countryLangPath,
  type RecipePage,
} from '@2yolks/contracts';
import { renderHome, renderCountryHome, renderRecipe } from '@2yolks/web/server';
import { createDb, recipes, recipeLocales, sources } from './db';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

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
    })
    .from(recipeLocales)
    .where(
      and(
        eq(recipeLocales.country, country.code),
        eq(recipeLocales.lang, lang ?? ''),
        eq(recipeLocales.status, 'published'),
      ),
    );
  return c.json({ country: country.code, lang, recipes: rows });
});

// --- SSR pages ----------------------------------------------------------

app.get('/', (c) => {
  const locales = COUNTRIES.filter((ct) => ct.wave === 1).flatMap((ct) =>
    (LOCALES[ct.code] ?? []).map((lang) => ({
      country: ct.code,
      countryName: ct.name,
      lang,
    })),
  );
  return c.html(renderHome({ locales }));
});

app.get('/:country', (c) => {
  const country = getCountry(c.req.param('country'));
  const lang = country && defaultLocale(country.code);
  if (!country || !lang) return c.notFound();
  return c.redirect(countryLangPath(country.code, lang), 302);
});

const countryHome = async (c: Context<{ Bindings: Bindings }>) => {
  const parsed = parsePath(`/${c.req.param('country')}/${c.req.param('lang')}/`);
  if (!parsed) return c.notFound();
  const country = getCountry(parsed.country);
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ slug: recipeLocales.slug, title: recipeLocales.title })
    .from(recipeLocales)
    .where(
      and(
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.lang, parsed.lang),
        eq(recipeLocales.status, 'published'),
      ),
    );
  return c.html(
    renderCountryHome({
      countryName: country?.name ?? parsed.country,
      country: parsed.country,
      lang: parsed.lang,
      recipes: rows,
    }),
  );
};
app.get('/:country/:lang', countryHome);
app.get('/:country/:lang/', countryHome);

app.get('/:country/:lang/:slug', async (c) => {
  const parsed = parsePath(c.req.path);
  if (!parsed?.slug) return c.notFound();
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(
      and(
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.lang, parsed.lang),
        eq(recipeLocales.slug, parsed.slug),
        eq(recipeLocales.status, 'published'),
      ),
    );
  const row = rows[0];
  if (!row) return c.notFound();

  // hreflang alternates: exact content equivalents of this same recipe only.
  const alternatesRows = await db
    .select({ country: recipeLocales.country, lang: recipeLocales.lang, slug: recipeLocales.slug })
    .from(recipeLocales)
    .where(and(eq(recipeLocales.recipeId, row.recipes.id), eq(recipeLocales.status, 'published')));
  const origin = new URL(c.req.url).origin;
  const alternates = alternatesRows.map((a) => ({
    hreflang: `${a.lang}-${a.country.toUpperCase()}`,
    href: `${origin}${countryLangPath(a.country, a.lang)}${a.slug}`,
  }));

  const page: RecipePage = {
    recipe: {
      id: row.recipes.id,
      sourceId: row.recipes.sourceId,
      originCountry: row.recipes.originCountry,
      imageKey: row.recipes.imageKey,
      createdAt: row.recipes.createdAt,
    },
    locale: {
      recipeId: row.recipe_locales.recipeId,
      country: row.recipe_locales.country,
      lang: row.recipe_locales.lang,
      title: row.recipe_locales.title,
      slug: row.recipe_locales.slug,
      intro: row.recipe_locales.intro,
      ingredientsJson: row.recipe_locales.ingredientsJson,
      stepsJson: row.recipe_locales.stepsJson,
      status: row.recipe_locales.status,
    },
    source: {
      id: row.sources.id,
      name: row.sources.name,
      url: row.sources.url,
      license: row.sources.license,
      clearedAt: row.sources.clearedAt,
      notes: row.sources.notes,
    },
  };
  return c.html(renderRecipe(page, alternates));
});

// Everything else falls through to static assets, then 404.
app.notFound((c) => c.text('Not found', 404));

export default app;
