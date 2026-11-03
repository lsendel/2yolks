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

import { isStructured, unitInfo, checkTranslation, checkStructuredTranslation, checkAllergens, ingredientText, type IngredientEntry } from './units';

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
  jumpToRecipe: string;
  servings: string;
  cookMode: string;
  exitCookMode: string;
  previousStep: string;
  nextStep: string;
  startTimer: string;
  timerDone: string;
  untestedBadge: string;
  untestedNote: string;
  about: string;
  howWeTest: string;
  print: string;
  home: string;
  tagline: string;
  share: string;
  copyLink: string;
  linkCopied: string;
  shareEmail: string;
}

const UI_STRINGS: Record<string, UiStrings> = {
  en: {
    ingredients: 'Ingredients', steps: 'Steps', source: 'Source',
    jumpToRecipe: 'Jump to recipe', servings: 'Servings', cookMode: 'Cook mode',
    exitCookMode: 'Exit cook mode', previousStep: 'Back', nextStep: 'Next',
    startTimer: 'Start timer', timerDone: 'Done!',
    untestedBadge: 'Not yet tested',
    untestedNote: 'Not yet tested in a kitchen. Written from standard techniques; we have not cooked it.',
    about: 'About', howWeTest: 'How we test and label recipes', print: 'Print', home: 'Home',
    tagline: 'Recipes worth cracking two eggs for.',
    share: 'Share', copyLink: 'Copy link', linkCopied: 'Link copied', shareEmail: 'Email',
  },
  es: {
    ingredients: 'Ingredientes', steps: 'Pasos', source: 'Fuente',
    jumpToRecipe: 'Ir a la receta', servings: 'Porciones', cookMode: 'Modo cocina',
    exitCookMode: 'Salir del modo cocina', previousStep: 'Atr\u00e1s', nextStep: 'Siguiente',
    startTimer: 'Iniciar temporizador', timerDone: '\u00a1Listo!',
    untestedBadge: 'A\u00fan no probada',
    untestedNote: 'A\u00fan no probada en cocina. Escrita con t\u00e9cnicas est\u00e1ndar; todav\u00eda no la hemos cocinado.',
    about: 'Acerca de', howWeTest: 'C\u00f3mo probamos y etiquetamos las recetas', print: 'Imprimir', home: 'Inicio',
    tagline: 'Recetas que valen dos huevos.',
    share: 'Compartir', copyLink: 'Copiar enlace', linkCopied: 'Enlace copiado', shareEmail: 'Correo',
  },
  fr: {
    ingredients: 'Ingr\u00e9dients', steps: '\u00c9tapes', source: 'Source',
    jumpToRecipe: 'Aller \u00e0 la recette', servings: 'Portions', cookMode: 'Mode cuisine',
    exitCookMode: 'Quitter le mode cuisine', previousStep: 'Retour', nextStep: 'Suivant',
    startTimer: 'D\u00e9marrer le minuteur', timerDone: 'Termin\u00e9 !',
    untestedBadge: 'Pas encore test\u00e9e',
    untestedNote: 'Pas encore test\u00e9e en cuisine. \u00c9crite \u00e0 partir de techniques courantes ; nous ne l\u2019avons pas encore cuisin\u00e9e.',
    about: '\u00c0 propos', howWeTest: 'Comment nous testons et \u00e9tiquetons les recettes', print: 'Imprimer', home: 'Accueil',
    tagline: 'Des recettes qui valent deux \u0153ufs.',
  },
};

export function uiStrings(lang: string): UiStrings {
  return UI_STRINGS[lang] ?? UI_STRINGS['en']!;
}

/** Per-country landing copy for listing pages (original text). */
export const COUNTRY_INTROS: Readonly<Record<string, { lang: string; text: string }>> = {
  us: { lang: 'en', text: 'Home-style American recipes, plus dishes American kitchens have made their own. Every recipe carries a clear label for whether it has been tested in a kitchen.' },
  mx: { lang: 'es', text: 'Recetas mexicanas escritas en espa\u00f1ol, con medidas en m\u00e9trico. Cada receta indica con claridad si ya se prob\u00f3 en cocina.' },
};

/** Quality state is explicit per recipe: tested only when a person recorded
 * a tested_at date. Never inferred from the source license. */
export function isUntested(recipe: { testedAt?: string | null }): boolean {
  return !recipe.testedAt;
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
  ingredients: IngredientEntry[];
  steps: string[];
  /** "country/lang" of the locale this one was translated from. Exactly one
   * locale per multi-locale submission (the original) leaves this unset. */
  translationOf?: string;
  translationMethod?: 'human' | 'machine';
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
      const strOk = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_LEN.item;
      const ingOk = (x: unknown): boolean =>
        strOk(x) || (isStructured(x) && x.name.length > 0 && x.name.length <= MAX_LEN.item &&
          (x.qty === null || (Number.isFinite(x.qty) && x.qty > 0)) &&
          (x.unit === undefined || x.unit === '' || unitInfo(x.unit) !== undefined || x.qty === null || /^[a-z]+$/.test(x.unit)));
      if (!Array.isArray(lc['ingredients']) || lc['ingredients'].length === 0 || !lc['ingredients'].every(ingOk))
        fail(`locales[${i}].ingredients`, 'non-empty array of strings or structured ingredients required');
      if (!Array.isArray(lc['steps']) || lc['steps'].length === 0 || !lc['steps'].every(strOk))
        fail(`locales[${i}].steps`, 'non-empty string array required');
      if (lc['translationOf'] !== undefined && typeof lc['translationOf'] !== 'string')
        fail(`locales[${i}].translationOf`, 'must be a country/lang string');
      if (lc['translationMethod'] !== undefined && lc['translationMethod'] !== 'human' && lc['translationMethod'] !== 'machine')
        fail(`locales[${i}].translationMethod`, "must be 'human' or 'machine'");
    });

    // Translation rules (fail closed). A single locale is an original. With
    // several, exactly one is the original and every other points at a locale
    // in this submission and declares how it was produced.
    if (errors.length === 0 && locs.length > 1) {
      const rows = locs as RecipeLocaleInput[];
      const key = (r: RecipeLocaleInput) => `${r.country}/${r.lang}`;
      const originals = rows.filter((r) => r.translationOf === undefined);
      if (originals.length !== 1) fail('locales', 'exactly one locale must be the original (no translationOf)');
      rows.forEach((r, i) => {
        if (r.translationOf === undefined) return;
        const src = rows.find((x) => key(x) === r.translationOf);
        if (!src || key(src) === key(r)) return fail(`locales[${i}].translationOf`, 'must name a different locale in this submission');
        if (src.translationOf !== undefined) return fail(`locales[${i}].translationOf`, 'must name the original locale, not another translation');
        if (!r.translationMethod) fail(`locales[${i}].translationMethod`, 'required for translated locales');
        const steps = checkTranslation(src, r);
        const ing = checkStructuredTranslation(src.ingredients, r.ingredients);
        const alg = checkAllergens(ingredientText(src.ingredients), ingredientText(r.ingredients));
        for (const p of [...steps.problems, ...ing.problems, ...alg.problems]) fail(`locales[${i}]`, `translation check: ${p}`);
      });
    } else if (errors.length === 0 && locs.length === 1 && (locs[0] as RecipeLocaleInput).translationOf !== undefined) {
      fail('locales[0].translationOf', 'a single locale cannot be a translation');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: sub as unknown as RecipeSubmission };
}


// ---------------------------------------------------------------------------
// Ingredient quantity parsing + scaling (serving scaler).
// Ingredients are stored as plain strings; a leading quantity (whole,
// decimal, fraction "a/b" or unicode glyph, mixed "1 1/2", or range "2-3")
// is parsed so the UI can scale it live. Everything after the quantity is
// opaque text (unit + name + note).
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, number> = {
  '\u00bc': 0.25, '\u00bd': 0.5, '\u00be': 0.75,
  '\u2153': 1 / 3, '\u2154': 2 / 3,
  '\u215b': 0.125, '\u215c': 0.375, '\u215d': 0.625, '\u215e': 0.875,
  '\u2155': 0.2, '\u2156': 0.4, '\u2157': 0.6, '\u2158': 0.8,
};

export interface ParsedIngredient {
  /** Leading quantity, or null when the line has none ("salt to taste"). */
  qty: number | null;
  /** Second quantity for ranges ("2-3 cups"). Null otherwise. */
  qtyEnd: number | null;
  /** Everything after the quantity: unit, name, notes. */
  rest: string;
}

export function parseIngredient(text: string): ParsedIngredient {
  const fracChars = Object.keys(UNICODE_FRACTIONS).join('');
  // number forms: mixed "1 1/2", fraction "1/2", unicode glyph, decimal, int
  const num = `(?:\\d+\\s+)?\\d+/\\d+|\\d+(?:\\.\\d+)?|[${fracChars}]`;
  const re = new RegExp(`^\\s*(${num})(?:\\s*(?:-|\\u2013)\\s*(${num}))?\\s*(.*)$`);
  const m = re.exec(text);
  if (!m) return { qty: null, qtyEnd: null, rest: text.trim() };
  const parse = (s: string): number | null => {
    const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = /^(\d+)\/(\d+)$/.exec(s);
    if (frac) {
      const d = Number(frac[2]);
      return d === 0 ? null : Number(frac[1]) / d;
    }
    if (s in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[s]!;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const qty = parse(m[1]!);
  const qtyEnd = m[2] ? parse(m[2]) : null;
  return { qty, qtyEnd, rest: (m[3] ?? '').trim() };
}

/** The serving scaler only rescales each ingredient's leading number. It is
 * unsafe when ingredient text carries other quantities (unit conversions
 * such as "(250 ml)", sub-amounts) or when steps quote ingredient amounts
 * ("add 1 cup"), because those would stay unscaled and contradict the
 * scaled list. Times and temperatures are not amounts and are ignored. */
export function scalingIsSafe(ingredients: string[], steps: string[]): boolean {
  if (ingredients.some((raw) => /\d/.test(parseIngredient(raw).rest))) return false;
  const amount =
    /\d[\d./\u00bc-\u00be\u2150-\u215e]*\s*(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|g|kg|ml|l|oz|lbs?|pounds?|tazas?|cucharadas?|cucharaditas?|litros?|gramos?)(?![\p{L}])/iu;
  return !steps.some((st) => amount.test(st));
}

/** Format a scaled quantity with unicode fractions (eighths and thirds). */
export function formatQty(n: number): string {
  const FRAC_DISPLAY: [number, string][] = [
    [0.125, '\u215b'], [0.2, '\u2155'], [0.25, '\u00bc'], [1 / 3, '\u2153'],
    [0.375, '\u215c'], [0.4, '\u2156'], [0.5, '\u00bd'], [0.6, '\u2157'],
    [0.625, '\u215d'], [2 / 3, '\u2154'], [0.75, '\u00be'], [0.8, '\u2158'],
    [0.875, '\u215e'],
  ];
  const whole = Math.floor(n + 1e-9);
  const rem = n - whole;
  if (rem < 0.06) return String(Math.round(n));
  let best = FRAC_DISPLAY[0]!;
  for (const f of FRAC_DISPLAY) if (Math.abs(f[0] - rem) < Math.abs(best[0] - rem)) best = f;
  if (Math.abs(best[0] - rem) > 0.06) return (Math.round(n * 10) / 10).toString();
  return whole > 0 ? `${whole} ${best[1]}` : best[1];
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
  testedAt?: string | null;
  testedBy?: string | null;
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
  translationOf?: string | null;
  translationMethod?: string | null;
  translationReviewedAt?: string | null;
  translationReviewedBy?: string | null;
  translationReviewerKind?: string | null;
}

export interface RecipePage {
  recipe: Recipe;
  locale: RecipeLocale;
  source: Source;
}
export * from './units';
