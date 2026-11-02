/**
 * @2yolks/contracts
 * Shared types, country registry, and slug table for the 2yolks platform.
 * No runtime dependencies: this package is safe to import from the worker,
 * the web app, and future scripts (harvester, enrichment).
 */

// ---------------------------------------------------------------------------
// Country registry
// Seeded from the directory platform's country-coverage receipt
// (60 routing countries, captured 2026-10-29). Wave 1 = US + Mexico per the
// approved platform plan; wave 0 = registered, not yet scheduled.
// ---------------------------------------------------------------------------

export interface Country {
  /** ISO 3166-1 alpha-2, lowercase. Used as the first URL segment. */
  code: string;
  name: string;
  /** Rollout wave. 1 = first build (us, mx); 0 = registered, unscheduled. */
  wave: number;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'us', name: 'United States', wave: 1 },
  { code: 'ca', name: 'Canada', wave: 0 },
  { code: 'mx', name: 'Mexico', wave: 1 },
  { code: 'bz', name: 'Belize', wave: 0 },
  { code: 'gt', name: 'Guatemala', wave: 0 },
  { code: 'sv', name: 'El Salvador', wave: 0 },
  { code: 'hn', name: 'Honduras', wave: 0 },
  { code: 'ni', name: 'Nicaragua', wave: 0 },
  { code: 'cr', name: 'Costa Rica', wave: 0 },
  { code: 'pa', name: 'Panama', wave: 0 },
  { code: 'ad', name: 'Andorra', wave: 0 },
  { code: 'al', name: 'Albania', wave: 0 },
  { code: 'am', name: 'Armenia', wave: 0 },
  { code: 'at', name: 'Austria', wave: 0 },
  { code: 'az', name: 'Azerbaijan', wave: 0 },
  { code: 'ba', name: 'Bosnia & Herzegovina', wave: 0 },
  { code: 'be', name: 'Belgium', wave: 0 },
  { code: 'bg', name: 'Bulgaria', wave: 0 },
  { code: 'by', name: 'Belarus', wave: 0 },
  { code: 'ch', name: 'Switzerland', wave: 0 },
  { code: 'cy', name: 'Cyprus', wave: 0 },
  { code: 'cz', name: 'Czechia', wave: 0 },
  { code: 'de', name: 'Germany', wave: 0 },
  { code: 'dk', name: 'Denmark', wave: 0 },
  { code: 'ee', name: 'Estonia', wave: 0 },
  { code: 'es', name: 'Spain', wave: 0 },
  { code: 'fi', name: 'Finland', wave: 0 },
  { code: 'fr', name: 'France', wave: 0 },
  { code: 'ge', name: 'Georgia', wave: 0 },
  { code: 'gr', name: 'Greece', wave: 0 },
  { code: 'hr', name: 'Croatia', wave: 0 },
  { code: 'hu', name: 'Hungary', wave: 0 },
  { code: 'ie', name: 'Ireland', wave: 0 },
  { code: 'is', name: 'Iceland', wave: 0 },
  { code: 'it', name: 'Italy', wave: 0 },
  { code: 'li', name: 'Liechtenstein', wave: 0 },
  { code: 'lt', name: 'Lithuania', wave: 0 },
  { code: 'lu', name: 'Luxembourg', wave: 0 },
  { code: 'lv', name: 'Latvia', wave: 0 },
  { code: 'mc', name: 'Monaco', wave: 0 },
  { code: 'md', name: 'Moldova', wave: 0 },
  { code: 'me', name: 'Montenegro', wave: 0 },
  { code: 'mk', name: 'North Macedonia', wave: 0 },
  { code: 'mt', name: 'Malta', wave: 0 },
  { code: 'nl', name: 'Netherlands', wave: 0 },
  { code: 'no', name: 'Norway', wave: 0 },
  { code: 'pl', name: 'Poland', wave: 0 },
  { code: 'pt', name: 'Portugal', wave: 0 },
  { code: 'ro', name: 'Romania', wave: 0 },
  { code: 'rs', name: 'Serbia', wave: 0 },
  { code: 'ru', name: 'Russia', wave: 0 },
  { code: 'se', name: 'Sweden', wave: 0 },
  { code: 'si', name: 'Slovenia', wave: 0 },
  { code: 'sk', name: 'Slovakia', wave: 0 },
  { code: 'sm', name: 'San Marino', wave: 0 },
  { code: 'tr', name: 'Türkiye', wave: 0 },
  { code: 'ua', name: 'Ukraine', wave: 0 },
  { code: 'uk', name: 'United Kingdom', wave: 0 },
  { code: 'va', name: 'Vatican City', wave: 0 },
  { code: 'au', name: 'Australia', wave: 0 },
] as const;

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): Country | undefined {
  return BY_CODE.get(code.toLowerCase());
}

export function waveCountries(wave: number): Country[] {
  return COUNTRIES.filter((c) => c.wave === wave);
}

// ---------------------------------------------------------------------------
// Locales
// Only locales with grounded demand are declared. Everything else is added
// per country when its wave is scheduled.
// ---------------------------------------------------------------------------

export const LOCALES: Readonly<Record<string, readonly string[]>> = {
  us: ['en'],
  mx: ['es'],
};

export function localesFor(countryCode: string): readonly string[] {
  return LOCALES[countryCode.toLowerCase()] ?? [];
}

export function defaultLocale(countryCode: string): string | undefined {
  return localesFor(countryCode)[0];
}

// ---------------------------------------------------------------------------
// UI strings per locale (recipe page chrome).
// ---------------------------------------------------------------------------

export interface UiStrings {
  ingredients: string;
  steps: string;
  source: string;
}

const UI_STRINGS: Record<string, UiStrings> = {
  en: { ingredients: 'Ingredients', steps: 'Steps', source: 'Source' },
  es: { ingredients: 'Ingredientes', steps: 'Pasos', source: 'Fuente' },
};

export function uiStrings(lang: string): UiStrings {
  return UI_STRINGS[lang] ?? UI_STRINGS['en']!;
}

// ---------------------------------------------------------------------------
// Recipe submission validation (fail closed). All ingestion paths - UGC
// forms, MCP submissions, harvester candidates - must parse through this
// schema before any row is written. Unknown/invalid input is rejected, never
// sanitized silently.
// ---------------------------------------------------------------------------

export interface RecipeLocaleInput {
  country: string;
  lang: string;
  title: string;
  slug?: string;
  intro?: string;
  ingredients: string[];
  steps: string[];
}

export interface RecipeSubmission {
  source: { name: string; url: string; license: string };
  originCountry?: string;
  locales: RecipeLocaleInput[];
}

export interface ValidationFailure {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: RecipeSubmission }
  | { ok: false; errors: ValidationFailure[] };

const MAX_LEN = { title: 200, intro: 2000, item: 1000, name: 200, url: 2000 };

export function validateRecipeSubmission(input: unknown): ValidationResult {
  const errors: ValidationFailure[] = [];
  const fail = (path: string, message: string) => errors.push({ path, message });

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ path: '', message: 'submission must be an object' }] };
  }
  const sub = input as Record<string, unknown>;

  // source
  const src = sub['source'];
  if (typeof src !== 'object' || src === null) {
    fail('source', 'source is required');
  } else {
    const s = src as Record<string, unknown>;
    if (typeof s['name'] !== 'string' || s['name'].length === 0 || s['name'].length > MAX_LEN.name)
      fail('source.name', 'required, max 200 chars');
    if (typeof s['url'] !== 'string' || !(s['url'].startsWith('https://') || s['url'].startsWith('internal:')) || s['url'].length > MAX_LEN.url)
      fail('source.url', 'must be https:// (or internal: for dev fixtures)');
    if (typeof s['license'] !== 'string' || s['license'].length === 0)
      fail('source.license', 'required (SPDX id, unknown, proprietary, or internal-demo)');
  }

  if (sub['originCountry'] !== undefined) {
    if (typeof sub['originCountry'] !== 'string' || !getCountry(sub['originCountry'] as string))
      fail('originCountry', 'unknown country code');
  }

  // locales
  const locs = sub['locales'];
  if (!Array.isArray(locs) || locs.length === 0) {
    fail('locales', 'at least one locale is required');
  } else {
    const seen = new Set<string>();
    locs.forEach((l, i) => {
      if (typeof l !== 'object' || l === null) return fail(`locales[${i}]`, 'must be an object');
      const lc = l as Record<string, unknown>;
      const country = lc['country'];
      const lang = lc['lang'];
      if (typeof country !== 'string' || !getCountry(country)) fail(`locales[${i}].country`, 'unknown country');
      if (typeof lang !== 'string' || typeof country !== 'string' || !localesFor(country).includes(lang))
        fail(`locales[${i}].lang`, 'locale not enabled for this country');
      if (typeof country === 'string' && typeof lang === 'string') {
        const key = `${country}:${lang}`;
        if (seen.has(key)) fail(`locales[${i}]`, 'duplicate country+lang locale');
        seen.add(key);
      }
      if (typeof lc['title'] !== 'string' || lc['title'].length === 0 || lc['title'].length > MAX_LEN.title)
        fail(`locales[${i}].title`, 'required, max 200 chars');
      if (lc['slug'] !== undefined && (typeof lc['slug'] !== 'string' || !SLUG_PATTERN.test(lc['slug'])))
        fail(`locales[${i}].slug`, 'must match slug pattern');
      if (lc['intro'] !== undefined && (typeof lc['intro'] !== 'string' || lc['intro'].length > MAX_LEN.intro))
        fail(`locales[${i}].intro`, 'max 2000 chars');
      const arrOk = (v: unknown): v is string[] =>
        Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= MAX_LEN.item);
      if (!arrOk(lc['ingredients'])) fail(`locales[${i}].ingredients`, 'non-empty string array required');
      if (!arrOk(lc['steps'])) fail(`locales[${i}].steps`, 'non-empty string array required');
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: sub as unknown as RecipeSubmission };
}

// ---------------------------------------------------------------------------
// Slug table (per approved plan):
//   /{country}/                          country market home (default locale)
//   /{country}/recipes/{id}-{slug}       recipe page
// The id is opaque and stable across locales; each locale adds its own
// translated slug beside it. A slug freezes once its language enters a
// sitemap; later changes are 301 redirects against the frozen map.
// hreflang alternates are exact content equivalents of the same recipe only.
// ---------------------------------------------------------------------------

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ID_PATTERN = /^[a-z0-9]+$/;

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!SLUG_PATTERN.test(slug)) throw new Error(`cannot slugify: ${title}`);
  return slug;
}

export function countryPath(country: string): string {
  return `/${country.toLowerCase()}/`;
}

export function recipePath(country: string, id: string, slug: string): string {
  return `${countryPath(country)}recipes/${id.toLowerCase()}-${slug}`;
}

export interface ParsedPath {
  country: string;
  id?: string;
  slug?: string;
}

/** Parse /{country}/ or /{country}/recipes/{id}-{slug}. Returns null when the
 * country is not registered or the shape does not match. */
export function parsePath(pathname: string): ParsedPath | null {
  const home = /^\/([a-z]{2})\/?$/.exec(pathname);
  if (home) {
    const country = home[1];
    return country && getCountry(country) ? { country } : null;
  }
  const rec = /^\/([a-z]{2})\/recipes\/([a-z0-9]+)-([a-z0-9-]+)\/?$/.exec(pathname);
  if (!rec) return null;
  const [, country, id, slug] = rec;
  if (!country || !id || !slug || !getCountry(country)) return null;
  return { country, id, slug };
}

// ---------------------------------------------------------------------------
// Recipe model (matches packages/api/migrations/0001_init.sql).
// Provenance fields are REQUIRED: no row without a source and its license.
// ---------------------------------------------------------------------------

export type RecipeStatus = 'draft' | 'published' | 'rejected';

export interface Source {
  id: string;
  name: string;
  url: string;
  /** SPDX-style license id or 'unknown'/'proprietary'. Unreviewed sources
   * must never feed published rows. */
  license: string;
  clearedAt: string | null;
  notes: string | null;
}

export interface Recipe {
  id: string;
  sourceId: string;
  originCountry: string | null;
  imageKey: string | null;
  createdAt: string;
}

export interface RecipeLocale {
  recipeId: string;
  country: string;
  lang: string;
  title: string;
  slug: string;
  intro: string | null;
  /** JSON array of ingredient strings, in order. */
  ingredientsJson: string;
  /** JSON array of step strings, in order. */
  stepsJson: string;
  status: RecipeStatus;
}

export interface RecipePage {
  recipe: Recipe;
  locale: RecipeLocale;
  source: Source;
}
