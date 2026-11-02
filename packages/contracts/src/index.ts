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
