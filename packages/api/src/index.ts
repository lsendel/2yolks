import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
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
  isRecipeCategorySlug,
  RECIPE_CATEGORY_SLUGS,
  categoryLabel,
  COLLECTION_SLUGS,
  COLLECTIONS,
  CUISINES,
  CATEGORY_INTROS,
  isCollectionSlug,
  isDietTag,
  isTimeBucket,
  isDifficultyLevel,
  resolveCuisineSlug,
  matchesCuisine,
  matchesCollection,
  availableCuisines,
  inferDiets,
  inferNoOven,
  inferDifficulty,
  searchCatalog,
  suggestCatalog,
  parseHaveParam,
  type SearchQuery,
  type RecipePage,
  asImageStyle,
  contributorSlug,
  contributorInitials,
  uiStrings,
} from '@2yolks/contracts';
import {
  browserLang,
  renderHome,
  renderRecipeIndex,
  renderCountryHome,
  renderRecipe,
  renderRecipeCardSvg,
  renderRecipeOgSvg,
  renderSearchPage,
  renderHubPage,
  renderHubDirectoryPage,
  renderSavedPage,
  renderAbout,
  renderPrivacy,
  renderHowWeTest,
  renderNotFound,
  discoveryRecipes,
  type SiteNavItem,
} from '@2yolks/web/server';
import { isUntested, localizedCountryName } from '@2yolks/contracts';
import type { ImageStyle } from '@2yolks/contracts';
import { recipeSlugAliases, createDb, recipes, recipeLocales, recipeImages, sources, published, imageCleared, searchGapLogs, recipeTestReports } from './db';
import { appApi } from './appapi';
import { mcpApp, getMcpManifest } from './mcp';
import { accountApp, readSessionUser, loadSavedRecipeIds, loadTopSearchGaps, SESSION_COOKIE, type AccountBindings } from './account';
import { build2YolksZelutoLinks, zeluto2YolksSyncApp } from './zeluto';

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
} & AccountBindings;

const app = new Hono<{ Bindings: Bindings }>();

const demoAllowed = (c: Context<{ Bindings: Bindings }>) => c.env.ALLOW_DEMO_SEED === 'true';

const SAFE_NAV_PARAMS = ['q', 'cat', 'time', 'diet', 'cuisine', 'difficulty', 'tested', 'method', 'page'] as const;

/** Global reading languages, drawn only from published rights-cleared content,
 * keeping the current page and active query filters when possible. */
async function siteNav(
  db: ReturnType<typeof createDb>,
  allowDemo: boolean,
  lang: string,
  currentUrl?: URL,
): Promise<SiteNavItem[]> {
  const rows = await db
    .selectDistinct({ lang: recipeLocales.lang })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, allowDemo));
  const names: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français' };
  const basePath = currentUrl?.pathname || '/';
  return rows
    .sort((a, b) => a.lang.localeCompare(b.lang))
    .map((r) => {
      const p = new URLSearchParams();
      if (currentUrl) {
        for (const k of SAFE_NAV_PARAMS) {
          const val = currentUrl.searchParams.get(k);
          if (val) p.set(k, val);
        }
      }
      if (basePath === '/') {
        p.set('lang', r.lang);
      } else if (r.lang !== 'en') {
        p.set('lang', r.lang);
      }
      const qs = p.toString();
      return {
        href: qs ? `${basePath}?${qs}` : basePath,
        label: names[r.lang] ?? r.lang,
        current: r.lang === lang,
      };
    });
}

// --- API ---------------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }));

// Accounts + private user drafts (email-code sign-in). Registered before /:country.
app.route('/account', accountApp);

// Native app JSON API (bearer-token sibling of /account). Mounted before /:country.
app.route('/api/v1', appApi);

// The country Cloudflare places this request in (cf-ipcountry header, else
// the cf object), registry-checked and lowercased; null when absent or
// unknown, never guessed. The native app uses it as the content-language
// fallback after the device locale (Luis, 2026-11-19); it is a hint, never
// an override, and it changes no responses by itself.
function detectedCountryCode(c: Context<{ Bindings: Bindings }>): string | null {
  const raw = c.req.header('cf-ipcountry') ?? (c.req.raw as { cf?: { country?: unknown } }).cf?.country;
  const code = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return code && getCountry(code) ? code : null;
}

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
  return c.json({ countries: COUNTRIES, locales: LOCALES, published: pub, detectedCountry: detectedCountryCode(c) });
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
      category: recipes.category,
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
  // Additive for the native app: per-row dish category (registered slug or
  // null) and the latest rights-cleared hero image, same gates as the SSR
  // list. Uncleared or unlabeled styles are null, never guessed; clients
  // render their own honest label from the style.
  const heroByRecipe = await heroImagesByRecipe(db);
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.json({
    country: country.code,
    lang,
    recipes: rows.map((r) => {
      const hero = heroByRecipe.get(r.id);
      return {
        slug: r.slug,
        title: r.title,
        lang: r.lang,
        id: r.id,
        category: r.category,
        heroImage: hero ? { url: `${origin}/img/recipe/${hero.id}`, style: hero.style } : null,
      };
    }),
  });
});


// Language feed for the native app's language-first home: one row per
// published recipe across all countries, preferring the requested language
// and falling back exactly like the web discovery list (the actual lang
// stays on the row so clients can show an honest fallback badge). Additive;
// rows carry the same category + rights-cleared hero fields as the per-
// country list.
app.get('/api/v1/recipes', async (c) => {
  const requested = c.req.query('lang') ?? 'en';
  const languages = [...new Set(Object.values(LOCALES).flat())].sort();
  if (!languages.includes(requested)) {
    return c.json({ error: 'unsupported language', languages }, 404);
  }
  const db = createDb(c.env.DB);
  const rows = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), requested);
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.json({
    lang: requested,
    languages,
    recipes: rows.map((r) => ({
      id: r.id,
      country: r.country,
      lang: r.lang,
      slug: r.slug,
      title: r.title,
      category: r.category ?? null,
      heroImage: r.imageId && r.imageStyle ? { url: `${origin}/img/recipe/${r.imageId}`, style: r.imageStyle } : null,
    })),
  }, 200, { 'cache-control': 'public, max-age=300' });
});

function parseSearchQuery(req: { query(name: string): string | undefined; queries(name: string): string[] | undefined }): SearchQuery {
  const q = (req.query('q') ?? '').trim().slice(0, 120);
  const rawCat = req.query('cat');
  const cat = rawCat && isRecipeCategorySlug(rawCat) ? rawCat : null;
  const rawTime = req.query('time');
  const time = isTimeBucket(rawTime) ? rawTime : null;
  const rawDiet = req.query('diet');
  const diet = isDietTag(rawDiet) ? rawDiet : null;
  const rawCuisine = req.query('cuisine');
  const cuisine = resolveCuisineSlug(rawCuisine);
  const rawDiff = req.query('difficulty');
  const difficulty = isDifficultyLevel(rawDiff) ? rawDiff : null;
  const tested = req.query('tested') === '1';
  const method = req.query('method') === 'no-oven' ? 'no-oven' : null;
  const rawHave = req.queries('have') ?? (req.query('have') ? [req.query('have')!] : []);
  const have = parseHaveParam(rawHave);
  const parsedPage = Number.parseInt(req.query('page') ?? '1', 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.min(200, parsedPage) : 1;

  return { q, cat, time, diet, cuisine, difficulty, tested, method, have, page: pageNum };
}

// Additive native contract. Uses the same parser, ranking and filters as /search.
// Intentionally read-only: no search-gap or account mutations.
app.get('/api/v1/search', async (c) => {
  const lang = c.req.query('lang') ?? 'en';
  const languages = [...new Set(Object.values(LOCALES).flat())].sort();
  if (!languages.includes(lang)) return c.json({ error: 'unsupported language', languages }, 404);
  const query = parseSearchQuery(c.req);
  const db = createDb(c.env.DB);
  const rows = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), lang);
  const result = searchCatalog(rows, query, lang);
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.json({
    lang, query, total: result.total, page: result.page, pageSize: result.pageSize,
    totalPages: result.totalPages, usedFuzzy: result.usedFuzzy,
    recipes: result.items.map((r) => ({
      id: r.id, country: r.country, lang: r.lang, slug: r.slug, title: r.title,
      category: r.category ?? null,
      heroImage: r.imageId && r.imageStyle ? { url: `${origin}/img/recipe/${r.imageId}`, style: r.imageStyle } : null,
    })),
  }, 200, { 'cache-control': 'public, max-age=120' });
});

app.get('/api/v1/search/suggest', async (c) => {
  const requested = c.req.query('lang') ?? 'en';
  const lang = ['en', 'es', 'fr'].includes(requested) ? requested : 'en';
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (!q) return c.json({ recipes: [], categories: [], ingredients: [] }, 200, { 'cache-control': 'public, max-age=120' });
  const db = createDb(c.env.DB);
  const rows = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), lang);
  const sug = suggestCatalog(rows, q, lang, (r) => recipePathFor(r.country, r.lang, r.slug));
  return c.json(sug, 200, { 'cache-control': 'public, max-age=120' });
});

// --- Discovery --------------------------------------------------------------

// Public metadata only. Tool catalogs and calls retain bearer auth.
app.get('/.well-known/mcp.json', (c) => c.json(getMcpManifest(), 200, {
  'cache-control': 'public, max-age=300',
}));

app.get('/robots.txt', (c) => {
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.text(
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nDisallow: /saved\nSitemap: ${origin}/sitemap.xml\n`,
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
  const urls: string[] = [
    `  <url>\n    <loc>${xmlEscape(origin + '/')}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(origin + '/')}" />\n    <xhtml:link rel="alternate" hreflang="es" href="${xmlEscape(origin + '/?lang=es')}" />\n    <xhtml:link rel="alternate" hreflang="fr" href="${xmlEscape(origin + '/?lang=fr')}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(origin + '/')}" />\n  </url>`,
    `  <url><loc>${xmlEscape(origin + '/about')}</loc></url>`,
    `  <url><loc>${xmlEscape(origin + '/how-we-test')}</loc></url>`,
    `  <url>\n    <loc>${xmlEscape(origin + '/recipes')}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(origin + '/recipes')}" />\n    <xhtml:link rel="alternate" hreflang="es" href="${xmlEscape(origin + '/recipes?lang=es')}" />\n    <xhtml:link rel="alternate" hreflang="fr" href="${xmlEscape(origin + '/recipes?lang=fr')}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(origin + '/recipes')}" />\n  </url>`,
  ];
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
  const addHubAlternates = (path: string) => {
    urls.push(
      `  <url>\n    <loc>${xmlEscape(origin + path)}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(origin + path)}" />\n    <xhtml:link rel="alternate" hreflang="es" href="${xmlEscape(origin + path + '?lang=es')}" />\n    <xhtml:link rel="alternate" hreflang="fr" href="${xmlEscape(origin + path + '?lang=fr')}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(origin + path)}" />\n  </url>`,
    );
  };
  if (rows.length > 0) {
    const discRows = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), 'en');
    addHubAlternates('/collections');
    addHubAlternates('/cuisine');
    for (const cat of RECIPE_CATEGORY_SLUGS) {
      if (discRows.some((r) => r.category === cat)) addHubAlternates(`/recipes/${cat}`);
    }
    for (const col of COLLECTION_SLUGS) {
      if (discRows.some((r) => matchesCollection(r, col))) addHubAlternates(`/collections/${col}`);
    }
    for (const cItem of availableCuisines(discRows, 'en')) {
      addHubAlternates(`/cuisine/${cItem.slug}`);
    }
    const cookSlugs = [...new Set(discRows.map((r) => r.authorSlug).filter((s): s is string => Boolean(s)))].sort();
    if (cookSlugs.length > 0) {
      addHubAlternates('/cooks');
      for (const cookSlug of cookSlugs) addHubAlternates(`/cooks/${cookSlug}`);
    }
  }
  for (const list of byRecipe.values()) {
    const linksList = list.map(
      (a) =>
        `    <xhtml:link rel="alternate" hreflang="${xmlEscape(`${a.lang}-${a.country.toUpperCase()}`)}" href="${xmlEscape(origin + recipePathFor(a.country, a.lang, a.slug))}" />`,
    );
    const primary = list[0];
    if (primary) {
      const defLang = defaultLocale(primary.country);
      const defRow = list.find((a) => a.country === primary.country && a.lang === defLang) ?? primary;
      linksList.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(origin + recipePathFor(defRow.country, defRow.lang, defRow.slug))}" />`,
      );
    }
    const links = linksList.join('\n');
    for (const r of list) {
      urls.push(
        `  <url>\n    <loc>${xmlEscape(origin + recipePathFor(r.country, r.lang, r.slug))}</loc>\n${links}\n  </url>`,
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


/** Count approved community kitchen-test reports per recipe id (migration 0008). */
async function approvedReportCountsByRecipe(db: ReturnType<typeof createDb>): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({ recipeId: recipeTestReports.recipeId })
      .from(recipeTestReports)
      .where(eq(recipeTestReports.status, 'approved'));
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.recipeId, (counts.get(r.recipeId) ?? 0) + 1);
    return counts;
  } catch {
    // Tolerate sparse test D1 schemas that omit migration 0008.
    return new Map();
  }
}

/** Latest rights-cleared hero image per recipe (migration 0004): the list
 * thumbnail and its honest label. Uncleared rows never reach the list. */
async function heroImagesByRecipe(db: ReturnType<typeof createDb>) {
  const rows = await db
    .select({ recipeId: recipeImages.recipeId, id: recipeImages.id, style: recipeImages.style })
    .from(recipeImages)
    .where(and(eq(recipeImages.kind, 'hero'), imageCleared()))
    .orderBy(desc(recipeImages.createdAt));
  const byRecipe = new Map<string, { id: string; style: ImageStyle }>();
  for (const r of rows) {
    // Fail closed: an unrecorded or malformed style never gets a guessed label.
    const style = asImageStyle(r.style);
    if (style && !byRecipe.has(r.recipeId)) byRecipe.set(r.recipeId, { id: r.id, style });
  }
  return byRecipe;
}

function parseIngredientsData(json: string | null | undefined): { searchNames: string; fullText: string; count: number } {
  if (!json) return { searchNames: '', fullText: '', count: 0 };
  try {
    const list = JSON.parse(json);
    if (!Array.isArray(list)) return { searchNames: '', fullText: '', count: 0 };
    const names: string[] = [];
    const rawLines: string[] = [];
    for (const entry of list) {
      if (typeof entry === 'string') {
        rawLines.push(entry);
        const cleaned = entry
          .replace(
            /^[0-9/.\s\u00bc-\u00be\u2150-\u215e]+(?:cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|g|gram|grams|kg|ml|oz|ounce|ounces|lb|lbs|pound|pounds|pinch|pinches|can|cans|package|packages|bunch|bunches)?\s*/i,
            '',
          )
          .trim() || entry;
        if (cleaned) names.push(cleaned);
      } else if (entry && typeof entry.name === 'string') {
        const nm = entry.name.trim();
        const full = entry.note ? `${nm} ${String(entry.note).trim()}` : nm;
        if (full.trim()) rawLines.push(full.trim());
        if (nm) names.push(nm);
      }
    }
    return { searchNames: names.join(' '), fullText: rawLines.join(' '), count: list.length };
  } catch {
    return { searchNames: '', fullText: '', count: 0 };
  }
}

function parseStepsData(json: string | null | undefined): { text: string; count: number } {
  if (!json) return { text: '', count: 0 };
  try {
    const list = JSON.parse(json);
    if (!Array.isArray(list)) return { text: '', count: 0 };
    const parts = list.filter((s): s is string => typeof s === 'string');
    return { text: parts.join(' '), count: parts.length };
  } catch {
    return { text: '', count: 0 };
  }
}

function extractIngredientNames(json: string | null | undefined): string {
  return parseIngredientsData(json).searchNames;
}

async function loadDiscoveryRecipeRows(db: ReturnType<typeof createDb>, demo: boolean) {
  const recipeRows = await db
    .select({
      id: recipeLocales.recipeId,
      country: recipeLocales.country,
      lang: recipeLocales.lang,
      slug: recipeLocales.slug,
      title: recipeLocales.title,
      intro: recipeLocales.intro,
      ingredientsJson: recipeLocales.ingredientsJson,
      stepsJson: recipeLocales.stepsJson,
      originCountry: recipes.originCountry,
      authorName: recipes.authorName,
      testedAt: recipes.testedAt,
      category: recipes.category,
      prepMinutes: recipes.prepMinutes,
      cookMinutes: recipes.cookMinutes,
      totalMinutes: recipes.totalMinutes,
    })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, demo));
  const [heroByRecipe, reportCounts] = await Promise.all([heroImagesByRecipe(db), approvedReportCountsByRecipe(db)]);
  return recipeRows.map((r) => {
    const ings = parseIngredientsData(r.ingredientsJson);
    const steps = parseStepsData(r.stepsJson);
    const authorName = r.authorName?.trim() || null;
    const approvedCount = reportCounts.get(r.id) ?? 0;
    return {
      id: r.id,
      country: r.country,
      lang: r.lang,
      slug: r.slug,
      title: r.title,
      originCountry: r.originCountry ?? null,
      authorName,
      authorSlug: contributorSlug(authorName),
      untested: isUntested({ testedAt: r.testedAt }),
      cookedCount: approvedCount || (r.testedAt ? 1 : 0),
      category: r.category,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      totalMinutes: r.totalMinutes,
      imageId: heroByRecipe.get(r.id)?.id ?? null,
      imageStyle: heroByRecipe.get(r.id)?.style ?? null,
      intro: r.intro ?? null,
      ingredients: ings.searchNames,
      diets: inferDiets(ings.fullText),
      noOven: inferNoOven(r.title, r.intro, steps.text),
      difficulty: inferDifficulty({
        totalMinutes: r.totalMinutes,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        stepsCount: steps.count,
        ingredientsCount: ings.count,
      }),
    };
  });
}

function discoveryLang(c: Context<{ Bindings: Bindings }>): { lang: string; explicit: string | null } {
  const requested = c.req.query('lang');
  const explicit = ['en', 'es', 'fr'].includes(requested ?? '') ? requested! : null;
  return { lang: explicit ?? browserLang(c.req.header('accept-language')), explicit };
}

app.get('/recipes', async (c) => {
  const requestedLang = c.req.query('lang');
  const lang = ['en', 'es', 'fr'].includes(requestedLang ?? '') ? requestedLang! : 'en';
  const db = createDb(c.env.DB);
  const rows = await loadDiscoveryRecipeRows(db, demoAllowed(c));
  const nav = await siteNav(db, demoAllowed(c), lang, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(renderRecipeIndex({ lang, recipes: rows }, nav, origin));
});

app.get('/recipes/:category', async (c) => {
  const cat = c.req.param('category');
  if (!isRecipeCategorySlug(cat)) return c.notFound();
  const { lang } = discoveryLang(c);
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), lang);
  const items = selected.filter((r) => r.category === cat);
  const hero = items.find((r) => r.imageId && r.imageStyle === 'photo') ?? items.find((r) => r.imageId && r.imageStyle);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const title = categoryLabel(cat, l) ?? cat;
  const intro = CATEGORY_INTROS[cat][l];
  const relatedHubs = RECIPE_CATEGORY_SLUGS
    .filter((slug) => slug !== cat && selected.some((r) => r.category === slug))
    .map((slug) => ({
      href: `/recipes/${slug}${lq}`,
      label: categoryLabel(slug, l) ?? slug,
      count: selected.filter((r) => r.category === slug).length,
    }));
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const searchHref = `/search?${l === 'en' ? '' : `lang=${l}&`}cat=${cat}`;
  return c.html(
    renderHubPage(
      {
        kind: 'category',
        slug: cat,
        lang: l,
        title,
        intro,
        iconSlug: cat,
        heroImage: hero && hero.imageId && hero.imageStyle ? { id: hero.imageId, style: hero.imageStyle, alt: hero.title } : null,
        recipes: items,
        searchHref,
        relatedHubs,
      },
      { canonicalPath: `/recipes/${cat}`, nav, origin, parentLabel: title, parentPath: '/recipes' },
    ),
    200,
    items.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/collections', async (c) => {
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const items = COLLECTION_SLUGS.map((slug) => ({
    slug,
    href: `/collections/${slug}${lq}`,
    label: COLLECTIONS[slug].title[l],
    description: COLLECTIONS[slug].intro[l],
    count: selected.filter((r) => matchesCollection(r, slug)).length,
    iconSlug: COLLECTIONS[slug].icon,
  }));
  const heading = l === 'es' ? 'Colecciones' : l === 'fr' ? 'Collections' : 'Collections';
  const intro = l === 'es'
    ? 'Listas temáticas de recetas listas para elegir según tu tiempo y antojo.'
    : l === 'fr'
      ? 'Des sélections thématiques de recettes selon votre temps et vos envies.'
      : 'Curated cooking lists grouped by timing, method, season, and ingredients.';
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubDirectoryPage({ kind: 'collections', lang: l, title: heading, intro, items }, { canonicalPath: '/collections', nav, origin }),
    200,
    items.every((i) => i.count === 0) ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/collections/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!isCollectionSlug(slug)) return c.notFound();
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const items = selected.filter((r) => matchesCollection(r, slug));
  const meta = COLLECTIONS[slug];
  const hero = items.find((r) => r.imageId && r.imageStyle === 'photo') ?? items.find((r) => r.imageId && r.imageStyle);
  const searchHref =
    slug === 'quick'
      ? `/search?${l === 'en' ? '' : `lang=${l}&`}time=30`
      : slug === 'no-oven'
        ? `/search?${l === 'en' ? '' : `lang=${l}&`}method=no-oven`
        : slug === 'vegetarian'
          ? `/search?${l === 'en' ? '' : `lang=${l}&`}diet=vegetarian`
          : `/search${lq}`;
  const relatedHubs = COLLECTION_SLUGS
    .filter((s) => s !== slug)
    .map((s) => ({
      href: `/collections/${s}${lq}`,
      label: COLLECTIONS[s].title[l],
      count: selected.filter((r) => matchesCollection(r, s)).length,
    }))
    .filter((h) => h.count > 0);
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubPage(
      {
        kind: 'collection',
        slug,
        lang: l,
        title: meta.title[l],
        intro: meta.intro[l],
        iconSlug: meta.icon,
        heroImage: hero && hero.imageId && hero.imageStyle ? { id: hero.imageId, style: hero.imageStyle, alt: hero.title } : null,
        recipes: items,
        searchHref,
        relatedHubs,
      },
      { canonicalPath: `/collections/${slug}`, nav, origin, parentLabel: l === 'es' ? 'Colecciones' : 'Collections', parentPath: '/collections' },
    ),
    200,
    items.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/cuisine', async (c) => {
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const items = availableCuisines(selected, l).map((cu) => ({
    slug: cu.slug,
    href: `/cuisine/${cu.slug}${lq}`,
    label: cu.label,
    description: CUISINES[cu.slug]!.intro[l],
    count: cu.count,
  }));
  const heading = l === 'es' ? 'Cocinas del mundo' : l === 'fr' ? 'Cuisines du monde' : 'Browse by cuisine';
  const intro = l === 'es'
    ? 'Explora recetas agrupadas por su cocina de origen.'
    : l === 'fr'
      ? 'Explorez les recettes par cuisine d’origine.'
      : 'Explore published recipes grouped by culinary origin.';
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubDirectoryPage({ kind: 'cuisine', lang: l, title: heading, intro, items }, { canonicalPath: '/cuisine', nav, origin }),
    200,
    items.every((i) => i.count === 0) ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/cuisine/:slug', async (c) => {
  const rawSlug = c.req.param('slug').toLowerCase();
  const canonicalSlug = resolveCuisineSlug(rawSlug);
  if (!canonicalSlug) return c.notFound();
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  if (rawSlug !== canonicalSlug) {
    return c.redirect(`/cuisine/${canonicalSlug}${lq}`, 301);
  }
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const items = selected.filter((r) => matchesCuisine(r, canonicalSlug));
  const meta = CUISINES[canonicalSlug]!;
  const hero = items.find((r) => r.imageId && r.imageStyle === 'photo') ?? items.find((r) => r.imageId && r.imageStyle);
  const relatedHubs = availableCuisines(selected, l)
    .filter((cu) => cu.slug !== canonicalSlug)
    .map((cu) => ({ href: `/cuisine/${cu.slug}${lq}`, label: cu.label, count: cu.count }));
  const marketHref = meta.marketCountry ? countryPath(meta.marketCountry) : null;
  const marketLabel = meta.marketCountry
    ? (l === 'es'
        ? `Edición ${localizedCountryName(meta.marketCountry, l)}`
        : l === 'fr'
          ? `Édition ${localizedCountryName(meta.marketCountry, l)}`
          : `${localizedCountryName(meta.marketCountry, l)} edition`)
    : null;
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubPage(
      {
        kind: 'cuisine',
        slug: canonicalSlug,
        lang: l,
        title: meta.title[l],
        intro: meta.intro[l],
        heroImage: hero && hero.imageId && hero.imageStyle ? { id: hero.imageId, style: hero.imageStyle, alt: hero.title } : null,
        marketHref,
        marketLabel,
        recipes: items,
        searchHref: `/search?${l === 'en' ? '' : `lang=${l}&`}cuisine=${canonicalSlug}`,
        relatedHubs,
      },
      { canonicalPath: `/cuisine/${canonicalSlug}`, nav, origin, parentLabel: l === 'es' ? 'Cocinas' : 'Cuisines', parentPath: '/cuisine' },
    ),
    200,
    items.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/cooks', async (c) => {
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const bySlug = new Map<string, { slug: string; name: string; count: number }>();
  for (const r of selected) {
    if (!r.authorSlug || !r.authorName) continue;
    const prev = bySlug.get(r.authorSlug);
    if (prev) prev.count += 1;
    else bySlug.set(r.authorSlug, { slug: r.authorSlug, name: r.authorName, count: 1 });
  }
  const t = uiStrings(l);
  const items = [...bySlug.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((co) => ({
      slug: co.slug,
      href: `/cooks/${co.slug}${lq}`,
      label: co.name,
      description: `${co.count} ${co.count === 1 ? t.recipeWord : t.recipesWord}`,
      count: co.count,
    }));
  const heading = t.cooksNav;
  const intro = l === 'es'
    ? 'Cocineros y autores que comparten recetas honestas en 2yolks.'
    : l === 'fr'
      ? 'Les cuisiniers et contributeurs qui partagent des recettes sur 2yolks.'
      : 'Home cooks and contributors sharing tested and honest recipes on 2yolks.';
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubDirectoryPage({ kind: 'cooks', lang: l, title: heading, intro, items }, { canonicalPath: '/cooks', nav, origin }),
    200,
    items.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/cooks/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const { lang } = discoveryLang(c);
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  const lq = l === 'en' ? '' : `?lang=${l}`;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), l);
  const items = selected.filter((r) => r.authorSlug === slug);
  if (items.length === 0) return c.notFound();
  const authorName = items[0]!.authorName!;
  const hero = items.find((r) => r.imageId && r.imageStyle === 'photo') ?? items.find((r) => r.imageId && r.imageStyle);
  const byOther = new Map<string, { slug: string; name: string; count: number }>();
  for (const r of selected) {
    if (!r.authorSlug || !r.authorName || r.authorSlug === slug) continue;
    const prev = byOther.get(r.authorSlug);
    if (prev) prev.count += 1;
    else byOther.set(r.authorSlug, { slug: r.authorSlug, name: r.authorName, count: 1 });
  }
  const relatedHubs = [...byOther.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((co) => ({ href: `/cooks/${co.slug}${lq}`, label: co.name, count: co.count }));
  const t = uiStrings(l);
  const intro = l === 'es'
    ? `Recetas publicadas compartidas por ${authorName} en 2yolks.`
    : l === 'fr'
      ? `Recettes publiées partagées par ${authorName} sur 2yolks.`
      : `Published recipes shared by ${authorName} on 2yolks.`;
  const nav = await siteNav(db, demoAllowed(c), l, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHubPage(
      {
        kind: 'cook',
        slug,
        lang: l,
        title: authorName,
        intro,
        avatarInitials: contributorInitials(authorName),
        heroImage: hero && hero.imageId && hero.imageStyle ? { id: hero.imageId, style: hero.imageStyle, alt: hero.title } : null,
        recipes: items,
        searchHref: `/search${lq}`,
        relatedHubs,
      },
      { canonicalPath: `/cooks/${slug}`, nav, origin, parentLabel: t.cooksNav, parentPath: '/cooks' },
    ),
  );
});

app.get('/search', async (c) => {
  const { lang } = discoveryLang(c);
  const query = parseSearchQuery(c.req);
  const { q = '', have = [], page: pageNum = 1 } = query;
  const db = createDb(c.env.DB);
  const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), lang);
  const result = searchCatalog(selected, query, lang);

  if (q.length >= 2 && result.total === 0 && pageNum === 1 && !/[<>]/.test(q)) {
    try {
      await db.insert(searchGapLogs).values({
        query: q.slice(0, 100),
        locale: lang,
        createdAt: new Date().toISOString(),
      });
    } catch { /* gap logging must never fail search */ }
  }

  let missingPrompts: string[] = [];
  if (result.total === 0) {
    const rawGaps = await loadTopSearchGaps(c.env.DB, lang, 5, selected);
    missingPrompts = rawGaps.filter((g) => g.toLowerCase() !== q.toLowerCase()).slice(0, 4);
  }

  const cuisines = availableCuisines(selected, lang);
  const categories = [...new Set(selected.map((r) => r.category).filter((x): x is string => Boolean(x)))];
  const nav = await siteNav(db, demoAllowed(c), lang, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const noindex = result.total === 0 || result.page > result.totalPages || (have?.length ?? 0) > 0;
  return c.html(
    renderSearchPage({ lang, query, result, cuisines, categories, missingPrompts }, nav, origin),
    200,
    noindex ? { 'x-robots-tag': 'noindex' } : undefined,
  );
});

app.get('/saved', async (c) => {
  const requested = c.req.query('lang');
  const lang = ['en', 'es', 'fr'].includes(requested ?? '') ? requested! : 'en';
  const db = createDb(c.env.DB);
  const user = await readSessionUser(c.env.DB, getCookie(c, SESSION_COOKIE));
  const savedIds = user ? await loadSavedRecipeIds(c.env.DB, user.id) : [];
  let savedRecipesRows: ReturnType<typeof discoveryRecipes> = [];
  if (user && savedIds.length > 0) {
    const selected = discoveryRecipes(await loadDiscoveryRecipeRows(db, demoAllowed(c)), lang);
    const byId = new Map(selected.map((r) => [r.id, r]));
    savedRecipesRows = savedIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  }
  const nav = await siteNav(db, demoAllowed(c), lang, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderSavedPage(
      { lang, signedIn: Boolean(user), userEmail: user?.email ?? null, recipes: savedRecipesRows, savedIds },
      nav,
      origin,
    ),
    200,
    { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' },
  );
});

app.get('/', async (c) => {
  const qRedirect = (c.req.query('q') ?? '').trim();
  const requestedLang=c.req.query('lang');
  // Pick 2A: an explicit ?lang= always wins; otherwise the browser's
  // Accept-Language defaults the catalogue language and the homepage shows
  // the visible switcher confirmation.
  const explicit=['en','es','fr'].includes(requestedLang??'')?requestedLang!:null;
  const lang=explicit ?? browserLang(c.req.header('accept-language'));
  const cat=c.req.query('cat');
  const activeCategory=cat && isRecipeCategorySlug(cat)?cat:null;
  if (qRedirect) {
    const p = new URLSearchParams();
    p.set('q', qRedirect);
    if (lang !== 'en') p.set('lang', lang);
    if (activeCategory) p.set('cat', activeCategory);
    return c.redirect(`/search?${p.toString()}`, 302);
  }
  const langNotice=!explicit && lang!=='en';
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
  const mapped = await loadDiscoveryRecipeRows(db, demoAllowed(c));
  const nav = await siteNav(db, demoAllowed(c), lang, new URL(c.req.url));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderHome(
      {
        locales: markets,
        lang,
        langNotice,
        activeCategory,
        recipes: mapped,
      },
      nav,
      origin,
    ),
  );
});

app.post('/api/search-gap', async (c) => {
  try {
    const body = (await c.req.json()) as { query?: string; locale?: string };
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 100) : '';
    const locale = typeof body?.locale === 'string' ? body.locale.trim().slice(0, 10) : 'en';
    if (!query) return c.json({ ok: false }, 400);
    const db = createDb(c.env.DB);
    await db.insert(searchGapLogs).values({
      query,
      locale,
      createdAt: new Date().toISOString(),
    });
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 500);
  }
});

const countryHome = async (c: Context<{ Bindings: Bindings }>) => {
  const parsed = parsePath(c.req.path);
  if (!parsed) return c.notFound();
  const country = getCountry(parsed.country);
  // Unscheduled markets (wave 0) are not launched: 404, never an empty 200.
  if (!country || country.wave === 0) return c.notFound();
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      slug: recipeLocales.slug,
      title: recipeLocales.title,
      id: recipeLocales.recipeId,
      country: recipeLocales.country,
      lang: recipeLocales.lang,
      intro: recipeLocales.intro,
      ingredientsJson: recipeLocales.ingredientsJson,
      testedAt: recipes.testedAt,
      category: recipes.category,
      totalMinutes: recipes.totalMinutes,
    })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(published(db, demoAllowed(c)));

  const pageLang = defaultLocale(parsed.country) ?? 'en';
  const byRecipeId = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byRecipeId.get(r.id) ?? [];
    list.push(r);
    byRecipeId.set(r.id, list);
  }
  const selectedRows: typeof rows = [];
  for (const list of byRecipeId.values()) {
    const matching =
      list.find((r) => r.country === parsed.country && r.lang === pageLang) ??
      list.find((r) => r.country === parsed.country) ??
      list.find((r) => r.lang === pageLang) ??
      list.find((r) => r.lang === 'en') ??
      list[0]!;
    selectedRows.push(matching);
  }
  selectedRows.sort((a, b) => {
    const aIsLocal = a.country === parsed.country ? 0 : 1;
    const bIsLocal = b.country === parsed.country ? 0 : 1;
    if (aIsLocal !== bIsLocal) return aIsLocal - bIsLocal;
    return a.id.localeCompare(b.id);
  });

  // ?cat=<slug> filters the listing by dish type. Unknown slugs are ignored
  // (full listing), never 404 on a hand-typed filter.
  const catParam = new URL(c.req.url).searchParams.get('cat');
  const activeCategory = catParam && isRecipeCategorySlug(catParam) ? catParam : null;
  const mapped = selectedRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    untested: isUntested({ testedAt: r.testedAt }),
    lang: r.lang,
    country: r.country,
    category: r.category ?? null,
    totalMinutes: r.totalMinutes,
    imageId: null as string | null,
    imageStyle: null as 'photo' | 'illustration' | 'graphic' | null,
    intro: r.intro ?? null,
    ingredients: extractIngredientNames(r.ingredientsJson),
  }));
  const heroByRecipe = await heroImagesByRecipe(db);
  for (const r of mapped) { const h = heroByRecipe.get(r.id); r.imageId = h?.id ?? null; r.imageStyle = h?.style ?? null; }
  const categories = [...new Set(mapped.map((r) => r.category).filter((x): x is string => Boolean(x)))].sort();
  const filtered = activeCategory ? mapped.filter((r) => r.category === activeCategory) : mapped;
  const nav = await siteNav(db, demoAllowed(c), pageLang);
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  return c.html(
    renderCountryHome(
      {
        countryName: localizedCountryName(parsed.country, pageLang),
        country: parsed.country,
        recipes: filtered,
        categories,
        activeCategory,
      },
      nav,
      origin,
    ),
    // Empty listings must not be indexed (thin-page gate).
    200,
    filtered.length === 0 ? { 'x-robots-tag': 'noindex' } : undefined,
  );
};
const staticLang = (c: Context<{ Bindings: Bindings }>) => {
  const q = c.req.query('lang');
  return q === 'es' || q === 'fr' ? q : 'en';
};
app.get('/about', async (c) => {
  const l = staticLang(c);
  return c.html(renderAbout(await siteNav(createDb(c.env.DB), demoAllowed(c), l, new URL(c.req.url)), c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin, l));
});
app.get('/privacy', async (c) => {
  const l = staticLang(c);
  return c.html(renderPrivacy(await siteNav(createDb(c.env.DB), demoAllowed(c), l, new URL(c.req.url)), c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin, l));
});
app.get('/how-we-test', async (c) => {
  const l = staticLang(c);
  return c.html(renderHowWeTest(await siteNav(createDb(c.env.DB), demoAllowed(c), l, new URL(c.req.url)), c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin, l));
});
app.get('/:country', countryHome);
app.get('/:country/', countryHome);

const recipeRoute = async (c: Context<{ Bindings: Bindings }>) => {
  const parsed = parsePath(c.req.path);
  if (!parsed?.slug) return c.notFound();
  const db = createDb(c.env.DB);
  const lang = parsed.lang ?? defaultLocale(parsed.country) ?? '';
  const localeRows = () =>
    db
      .select()
      .from(recipeLocales)
      .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
      .innerJoin(sources, eq(recipes.sourceId, sources.id));

  // Clean slug-only URLs (/{country}/recipes/{slug}) resolve against the live
  // slug table first: the full trailing segment is the slug.
  let canonical = (
    await localeRows().where(
      and(
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.slug, parsed.slug),
        eq(recipeLocales.lang, lang),
        published(db, demoAllowed(c)),
      ),
    )
  )[0];

  if (!canonical && parsed.id && parsed.legacySlug) {
    // Legacy /{country}/recipes/{id}-{slug} shape: resolve the id and send a
    // permanent redirect to the clean slug URL. The recipe is looked up by
    // its immutable internal id, so every legacy URL keeps working forever.
    const legacyRows = await localeRows().where(
      and(
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.recipeId, parsed.id),
        eq(recipeLocales.lang, lang),
        published(db, demoAllowed(c)),
      ),
    );
    // 301 only when exactly one visible locale row exists for this
    // recipe+country (no unordered guesses). An unknown legacy id falls
    // through to the alias map before 404ing.
    const target = legacyRows.length === 1 ? legacyRows[0] : undefined;
    if (target) {
      return c.redirect(
        recipePathFor(parsed.country, target.recipe_locales.lang, target.recipe_locales.slug),
        301,
      );
    }
  }

  if (!canonical) {
    // Frozen map (migration 0005): a slug that left the sitemap redirects to
    // the recipe's current published slug in this country+lang, never to a
    // guess. Alias rows are permanent reservations written on unpublish.
    const alias = await db
      .select({ recipeId: recipeSlugAliases.recipeId })
      .from(recipeSlugAliases)
      .where(and(eq(recipeSlugAliases.country, parsed.country), eq(recipeSlugAliases.lang, lang), eq(recipeSlugAliases.slug, parsed.slug)))
      .limit(1);
    const holder = alias[0];
    if (!holder) return c.notFound();
    const current = await localeRows().where(
      and(
        eq(recipeLocales.recipeId, holder.recipeId),
        eq(recipeLocales.country, parsed.country),
        eq(recipeLocales.lang, lang),
        published(db, demoAllowed(c)),
      ),
    );
    const first = current[0];
    const target = current.length === 1 && first && first.recipe_locales.slug !== parsed.slug ? first : undefined;
    if (!target) return c.notFound();
    return c.redirect(recipePathFor(parsed.country, target.recipe_locales.lang, target.recipe_locales.slug), 301);
  }
  const recipeId = canonical.recipe_locales.recipeId;

  const alternatesRows = await db
    .select({ country: recipeLocales.country, lang: recipeLocales.lang, slug: recipeLocales.slug })
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(eq(recipeLocales.recipeId, recipeId), published(db, demoAllowed(c))));
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const defaultLang = defaultLocale(parsed.country);
  const alternates = alternatesRows.map((a) => ({
    hreflang: `${a.lang}-${a.country.toUpperCase()}`,
    href: `${origin}${recipePathFor(a.country, a.lang, a.slug)}`,
  }));
  // x-default points at the default-locale version when one exists.
  const def = alternatesRows.find((a) => a.country === parsed.country && a.lang === defaultLang);
  if (def) {
    alternates.push({
      hreflang: 'x-default',
      href: `${origin}${recipePathFor(def.country, def.lang, def.slug)}`,
    });
  }

  // Latest rights-cleared hero image, if any (migration 0004). The page
  // renderer falls back to the title graphic when this is null. Uncleared
  // rows (recorded provenance without the rightsConfirmed stamp) never reach
  // the page.
  const heroRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, recipeId), eq(recipeImages.kind, 'hero'), imageCleared()))
    .orderBy(desc(recipeImages.createdAt))
    .limit(1);
  // Cleared step images, latest first so the newest row per step wins.
  const stepRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style, stepIndex: recipeImages.stepIndex })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, recipeId), eq(recipeImages.kind, 'step'), imageCleared()))
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
  let approvedReportCount = 0;
  try {
    const approvedReports = await db
      .select({ id: recipeTestReports.id })
      .from(recipeTestReports)
      .where(and(eq(recipeTestReports.recipeId, recipeId), eq(recipeTestReports.status, 'approved')));
    approvedReportCount = approvedReports.length;
  } catch { /* tolerate sparse test D1 schemas without migration 0008 */ }
  const cookedCount = approvedReportCount || (canonical.recipes.testedAt ? 1 : 0);

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
      authorName: canonical.recipes.authorName?.trim() || null,
      cookedCount,
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
  const nav = alternates.filter(a=>a.hreflang!=='x-default').map(a=>({href:a.href,label:({en:'English',es:'Español',fr:'Français'} as Record<string,string>)[a.hreflang.split('-')[0]!]??a.hreflang,current:a.hreflang.toLowerCase()===`${page.locale.lang}-${page.locale.country}`.toLowerCase()}));
  const [otherRows, relHeroByRecipe] = await Promise.all([
    db
      .select({ id: recipeLocales.recipeId, country: recipeLocales.country, lang: recipeLocales.lang, slug: recipeLocales.slug, title: recipeLocales.title, testedAt: recipes.testedAt, category: recipes.category, totalMinutes: recipes.totalMinutes, authorName: recipes.authorName })
      .from(recipeLocales)
      .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
      .innerJoin(sources, eq(recipes.sourceId, sources.id))
      .where(and(ne(recipeLocales.recipeId, recipeId), published(db, demoAllowed(c)))),
    heroImagesByRecipe(db),
  ]);
  const byRelId = new Map<string, typeof otherRows>();
  for (const r of otherRows) {
    const list = byRelId.get(r.id) ?? [];
    list.push(r);
    byRelId.set(r.id, list);
  }
  const related = [...byRelId.values()]
    .map((list) => list.find((r) => r.lang === page.locale.lang) ?? list.find((r) => r.lang === 'en') ?? list[0]!)
    .sort((a, b) => {
      const aCat = a.category && a.category === page.recipe.category ? 0 : 1;
      const bCat = b.category && b.category === page.recipe.category ? 0 : 1;
      return aCat - bCat || a.title.localeCompare(b.title);
    })
    .slice(0, 4)
    .map((r) => {
      const h = relHeroByRecipe.get(r.id);
      const authorName = r.authorName?.trim() || null;
      return {
        id: r.id,
        country: r.country,
        lang: r.lang,
        slug: r.slug,
        title: r.title,
        untested: isUntested({ testedAt: r.testedAt }),
        category: r.category,
        totalMinutes: r.totalMinutes,
        imageId: h?.id ?? null,
        imageStyle: h?.style ?? null,
        authorName,
        authorSlug: contributorSlug(authorName),
      };
    });
  return c.html(renderRecipe(page, alternates, { nav, countryName: localizedCountryName(parsed.country, page.locale.lang), related }));
};
const makeRecipeSvgRoute =
  (suffixRe: RegExp, renderer: (page: RecipePage, origin: string) => string) =>
  async (c: Context<{ Bindings: Bindings }>) => {
    const basePath = c.req.path.replace(suffixRe, '');
    const parsed = parsePath(basePath);
    if (!parsed?.slug) return c.text('not found', 404, { 'cache-control': 'no-store' });
    const db = createDb(c.env.DB);
    const lang = parsed.lang ?? defaultLocale(parsed.country) ?? '';
    const rows = await db
      .select()
      .from(recipeLocales)
      .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
      .innerJoin(sources, eq(recipes.sourceId, sources.id))
      .where(
        and(
          eq(recipeLocales.country, parsed.country),
          eq(recipeLocales.slug, parsed.slug),
          eq(recipeLocales.lang, lang),
          published(db, demoAllowed(c)),
        ),
      )
      .limit(1);
    const canonical = rows[0];
    if (!canonical) return c.text('not found', 404, { 'cache-control': 'no-store' });
    const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
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
    const svg = renderer(page, origin);
    return c.body(svg, 200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': canonical.sources.license === 'internal-demo' ? 'no-store' : 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    });
  };
const recipeCardSvgRoute = makeRecipeSvgRoute(/\/card\.svg$/, renderRecipeCardSvg);
const recipeOgSvgRoute = makeRecipeSvgRoute(/\/og\.svg$/, renderRecipeOgSvg);
app.get('/:country/recipes/:idSlug/card.svg', recipeCardSvgRoute);
app.get('/:country/:lang/recipes/:idSlug/card.svg', recipeCardSvgRoute);
app.get('/:country/recipes/:idSlug/og.svg', recipeOgSvgRoute);
app.get('/:country/:lang/recipes/:idSlug/og.svg', recipeOgSvgRoute);
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

// --- Internal Zeluto Dagster Sync + Super-Admin Links -----------------------
app.route('/api/internal/zeluto-sync', zeluto2YolksSyncApp);

app.get('/api/admin/zeluto', (c) => {
  const expected = (c.env.ADMIN_MCP_API_KEY || '').trim();
  if (!expected) return c.json({ error: 'admin_not_configured' }, 503);
  const m = /^Bearer\s+(.+)$/i.exec((c.req.header('authorization') || '').trim());
  if (!m?.[1] || m[1].trim() !== expected) return c.json({ error: 'unauthorized' }, 401);
  const links = build2YolksZelutoLinks({
    zelutoUrl: c.env.ZELUTO_URL,
    brandOrgId: c.env.ZELUTO_BRAND_ORG_ID,
  });
  return c.json({
    ok: true,
    brandWorkspaceUrl: links.brandWorkspaceUrl,
    platformAdminRegistrationsUrl: links.platformAdminUrl,
  });
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
