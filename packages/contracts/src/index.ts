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

/** Display name for a country in the page's language. Launched (wave-1)
 * countries are translated; the rest fall back to the catalogue (English)
 * name until their market launches. */
const COUNTRY_DISPLAY: Record<string, Record<string, string>> = {
  us: { es: 'Estados Unidos', fr: '\u00c9tats-Unis' },
  mx: { es: 'M\u00e9xico', fr: 'Mexique' },
};
export function localizedCountryName(code: string, lang: string): string {
  const ct = getCountry(code);
  if (!ct) return code.toUpperCase();
  return COUNTRY_DISPLAY[code]?.[lang] ?? ct.name;
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
  // First entry is the country's default locale (keeps the legacy URL).
  // Registering a locale does not publish anything: pages and homepage links
  // appear only for locale rows that are actually published.
  us: ['en', 'es', 'fr'],
  mx: ['es', 'en', 'fr'],
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
  machineNote: string;
  about: string;
  howWeTest: string;
  print: string;
  home: string;
  tagline: string;
  share: string;
  copyLink: string;
  linkCopied: string;
  shareEmail: string;
  units: string;
  unitsMetric: string;
  unitsUs: string;
  browseByCountry: string;
  allRecipes: string;
  categories: string;
  allCategories: string;
  skipToContent: string;
  recipeWord: string;
  recipesWord: string;
  testingShort: string;
  emptyCategory: string;
  timePrep: string;
  timeCook: string;
  timeRest: string;
  timeTotal: string;
  imageIllustrationNote: string;
  imageLabelPhoto: string;
  imageLabelIllustration: string;
  imageLabelGraphic: string;
  copyIngredients: string;
  ingredientsCopied: string;
  copyRecipeCard: string;
  recipeCardCopied: string;
  shareHeading: string;
  shareSubhead: string;
  moreToCook: string;
  searchPlaceholder: string;
  checkedProgress: string;
}

const UI_STRINGS: Record<string, UiStrings> = {
  en: {
    ingredients: 'Ingredients', steps: 'Steps', source: 'Source',
    jumpToRecipe: 'Jump to recipe', servings: 'Servings', cookMode: 'Cook mode',
    exitCookMode: 'Exit cook mode', previousStep: 'Back', nextStep: 'Next',
    startTimer: 'Start timer', timerDone: 'Done!',
    untestedBadge: 'Not yet tested',
    untestedNote: 'Not yet tested in a kitchen. Written from standard techniques; we have not cooked it.',
    machineNote: 'Machine-translated from the original recipe. Checked by automated tests and an AI review; not reviewed by a native speaker. If anything looks off, follow the original-language version.',
    about: 'About', howWeTest: 'How we test and label recipes', print: 'Print', home: 'Home',
    tagline: 'Honest recipes, clearly labeled.',
    share: 'Share', copyLink: 'Copy link', linkCopied: 'Link copied', shareEmail: 'Email',
    units: 'Units', unitsMetric: 'Metric', unitsUs: 'US customary',
    browseByCountry: 'Browse by country', allRecipes: 'All recipes',
    categories: 'Categories', allCategories: 'All', skipToContent: 'Skip to content',
    recipeWord: 'recipe', recipesWord: 'recipes',
    testingShort: 'How we test', emptyCategory: 'No recipes in this category yet.',
    timePrep: 'Prep', timeCook: 'Cook', timeRest: 'Rest', timeTotal: 'Total',
    imageIllustrationNote: 'Illustration generated for this recipe - not a photo of the cooked dish.',
    imageLabelPhoto: 'Photo',
    imageLabelIllustration: 'AI illustration',
    imageLabelGraphic: 'Graphic',
    copyIngredients: 'Copy list', ingredientsCopied: 'List copied',
    copyRecipeCard: 'Copy recipe card', recipeCardCopied: 'Card copied',
    shareHeading: 'Share this recipe',
    shareSubhead: 'No ads, no life story — send a clean recipe link to a friend or group chat.',
    moreToCook: 'More to cook',
    searchPlaceholder: 'Filter recipes by dish or category…',
    checkedProgress: 'checked',
  },
  es: {
    ingredients: 'Ingredientes', steps: 'Pasos', source: 'Fuente',
    jumpToRecipe: 'Ir a la receta', servings: 'Porciones', cookMode: 'Modo cocina',
    exitCookMode: 'Salir del modo cocina', previousStep: 'Atr\u00e1s', nextStep: 'Siguiente',
    startTimer: 'Iniciar temporizador', timerDone: '\u00a1Listo!',
    untestedBadge: 'A\u00fan no probada',
    untestedNote: 'A\u00fan no probada en cocina. Escrita con t\u00e9cnicas est\u00e1ndar; todav\u00eda no la hemos cocinado.',
    machineNote: 'Traducci\u00f3n autom\u00e1tica de la receta original. Revisada con pruebas autom\u00e1ticas y una revisi\u00f3n con IA; no la ha revisado un hablante nativo. Si algo no parece correcto, sigue la versi\u00f3n en el idioma original.',
    about: 'Acerca de', howWeTest: 'C\u00f3mo probamos y etiquetamos las recetas', print: 'Imprimir', home: 'Inicio',
    tagline: 'Recetas honestas, con etiquetas claras.',
    share: 'Compartir', copyLink: 'Copiar enlace', linkCopied: 'Enlace copiado', shareEmail: 'Correo',
    units: 'Unidades', unitsMetric: 'M\u00e9trico', unitsUs: 'EE. UU.',
    browseByCountry: 'Explora por pa\u00eds', allRecipes: 'Todas las recetas',
    categories: 'Categor\u00edas', allCategories: 'Todas', skipToContent: 'Saltar al contenido',
    recipeWord: 'receta', recipesWord: 'recetas',
    testingShort: 'C\u00f3mo probamos', emptyCategory: 'A\u00fan no hay recetas en esta categor\u00eda.',
    timePrep: 'Preparaci\u00f3n', timeCook: 'Cocci\u00f3n', timeRest: 'Reposo', timeTotal: 'Total',
    imageIllustrationNote: 'Ilustraci\u00f3n generada para esta receta: no es una foto del plato cocinado.',
    imageLabelPhoto: 'Foto',
    imageLabelIllustration: 'Ilustraci\u00f3n de IA',
    imageLabelGraphic: 'Gr\u00e1fico',
    copyIngredients: 'Copiar lista', ingredientsCopied: 'Lista copiada',
    copyRecipeCard: 'Copiar ficha', recipeCardCopied: 'Ficha copiada',
    shareHeading: 'Comparte esta receta',
    shareSubhead: 'Sin anuncios ni relleno — env\u00eda la receta directa a un amigo o chat grupal.',
    moreToCook: 'M\u00e1s para cocinar',
    searchPlaceholder: 'Filtrar recetas por plato o categor\u00eda…',
    checkedProgress: 'marcados',
  },
  fr: {
    ingredients: 'Ingr\u00e9dients', steps: '\u00c9tapes', source: 'Source',
    jumpToRecipe: 'Aller \u00e0 la recette', servings: 'Portions', cookMode: 'Mode cuisine',
    exitCookMode: 'Quitter le mode cuisine', previousStep: 'Retour', nextStep: 'Suivant',
    startTimer: 'D\u00e9marrer le minuteur', timerDone: 'Termin\u00e9 !',
    untestedBadge: 'Pas encore test\u00e9e',
    untestedNote: 'Pas encore test\u00e9e en cuisine. \u00c9crite \u00e0 partir de techniques courantes ; nous ne l\u2019avons pas encore cuisin\u00e9e.',
    machineNote: 'Traduction automatique de la recette originale. V\u00e9rifi\u00e9e par des tests automatiques et une relecture par IA ; non relue par un locuteur natif. Si quelque chose semble inexact, suivez la version dans la langue d\u2019origine.',
    about: '\u00c0 propos', howWeTest: 'Comment nous testons et \u00e9tiquetons les recettes', print: 'Imprimer', home: 'Accueil',
    tagline: 'Des recettes honn\u00eates, clairement \u00e9tiquet\u00e9es.',
    share: 'Partager', copyLink: 'Copier le lien', linkCopied: 'Lien copi\u00e9', shareEmail: 'E-mail',
    units: 'Unit\u00e9s', unitsMetric: 'M\u00e9trique', unitsUs: 'Am\u00e9ricaines (US)',
    browseByCountry: 'Explorer par pays', allRecipes: 'Toutes les recetas'.replace('recetas', 'recettes'),
    categories: 'Cat\u00e9gories', allCategories: 'Toutes', skipToContent: 'Aller au contenu',
    recipeWord: 'recette', recipesWord: 'recettes',
    testingShort: 'Comment nous testons', emptyCategory: 'Aucune recette dans cette cat\u00e9gorie pour le moment.',
    timePrep: 'Pr\u00e9paration', timeCook: 'Cuisson', timeRest: 'Repos', timeTotal: 'Total',
    imageIllustrationNote: 'Illustration g\u00e9n\u00e9r\u00e9e pour cette recette - ce n\u2019est pas une photo du plat cuisin\u00e9.',
    imageLabelPhoto: 'Photo',
    imageLabelIllustration: 'Illustration IA',
    imageLabelGraphic: 'Graphique',
    copyIngredients: 'Copier la liste', ingredientsCopied: 'Liste copi\u00e9e',
    copyRecipeCard: 'Copier la fiche', recipeCardCopied: 'Fiche copi\u00e9e',
    shareHeading: 'Partager cette recette',
    shareSubhead: 'Sans publicit\u00e9 ni d\u00e9tour — envoyez la recette directement \u00e0 un ami ou un groupe.',
    moreToCook: '\u00c0 cuisiner aussi',
    searchPlaceholder: 'Filtrer les recettes par plat ou cat\u00e9gorie…',
    checkedProgress: 'coch\u00e9s',
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

// ---------------------------------------------------------------------------
// Dish-type categories
// A bounded, locale-invariant taxonomy grounded in the recipes actually
// published. Stored as a slug on recipes.category (NULL = uncategorized,
// shown under "All"). Labels are display-only; register a slug here before
// any row may use it, so category values never drift into free text.
// ---------------------------------------------------------------------------

export const CATEGORIES: Readonly<Record<RecipeCategorySlug, { en: string; es: string; fr: string }>> = {
  'soups-stews': { en: 'Soups & stews', es: 'Sopas y guisos', fr: 'Soupes et rago\u00fbts' },
  dumplings: { en: 'Dumplings', es: 'Dumplings', fr: 'Raviolis' },
  'tacos-tortillas': { en: 'Tacos & tortilla dishes', es: 'Tacos y platos de tortilla', fr: 'Tacos et plats \u00e0 la tortilla' },
};

// Honest-imagery styles the UI is allowed to label (migration 0004 CHECK).
// Anything else - NULL, unknown or malformed - fails closed: callers render
// no image rather than guess a label. Defense in depth past the DB CHECK.
export const IMAGE_STYLES = ['photo', 'illustration', 'graphic'] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export function asImageStyle(v: unknown): ImageStyle | null {
  return typeof v === 'string' && (IMAGE_STYLES as readonly string[]).includes(v) ? (v as ImageStyle) : null;
}

/** Localized display label for a stored category slug; null when the slug is
 * missing or unregistered (callers render nothing, never the raw slug). */
export function categoryLabel(slug: string | null | undefined, lang: string): string | null {
  if (!slug || !isRecipeCategorySlug(slug)) return null;
  const entry = CATEGORIES[slug];
  return (entry as unknown as Record<string, string>)[lang] ?? entry.en;
}

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
  /** Optional structured timing/yield (see parseTimeFields). */
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  restMinutes?: number | null;
  totalMinutes?: number | null;
  baseServings?: number | null;
  category?: RecipeCategorySlug | null;
}

// ---------------------------------------------------------------------------
// Structured timing/yield fields (migration 0004). Shared by every ingestion
// path (submissions, MCP create/update). Values are nullable; explicit null
// clears on update. Numbers are validated, never guessed.
// ---------------------------------------------------------------------------

export const MAX_RECIPE_MINUTES = 10080; // one week; caps marinating/curing

export interface RecipeTimeFields {
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  totalMinutes: number | null;
  baseServings: number | null;
}

const TIME_KEYS: Record<string, keyof RecipeTimeFields> = {
  prepMinutes: 'prepMinutes', prep_minutes: 'prepMinutes',
  cookMinutes: 'cookMinutes', cook_minutes: 'cookMinutes',
  restMinutes: 'restMinutes', rest_minutes: 'restMinutes',
  totalMinutes: 'totalMinutes', total_minutes: 'totalMinutes',
  baseServings: 'baseServings', base_servings: 'baseServings',
};

export type TimeFieldsParse =
  | { ok: true; values: Partial<RecipeTimeFields>; warnings: string[] }
  | { ok: false; error: string };

/** Reads the optional timing/yield keys out of a submission or MCP argument
 * object. A key set to null means "clear" (update paths); an absent key is
 * left untouched. */
export function parseTimeFields(input: Record<string, unknown>): TimeFieldsParse {
  const values: Partial<RecipeTimeFields> = {};
  const warnings: string[] = [];
  for (const [rawKey, field] of Object.entries(TIME_KEYS)) {
    if (!(rawKey in input) || field in values) continue;
    const v = input[rawKey];
    if (v === undefined) continue;
    if (v === null) {
      values[field] = null;
      continue;
    }
    if (field === 'baseServings') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1000) {
        return { ok: false, error: `${rawKey} must be a number in (0, 1000]` };
      }
      values[field] = v;
      continue;
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_RECIPE_MINUTES) {
      return { ok: false, error: `${rawKey} must be an integer in [0, ${MAX_RECIPE_MINUTES}] minutes` };
    }
    if (field === 'totalMinutes' && v === 0) {
      return { ok: false, error: 'totalMinutes must be at least 1 when provided' };
    }
    values[field] = v;
  }
  const total = values.totalMinutes;
  if (typeof total === 'number') {
    const active = (values.prepMinutes ?? 0) + (values.cookMinutes ?? 0);
    if (active > total) {
      warnings.push('totalMinutes is less than prep+cook; only consistent if they overlap');
    }
  }
  return { ok: true, values, warnings };
}

// ---------------------------------------------------------------------------
// Locale-invariant dish-type categories (migration 0004). The slug list is
// the contract; localized display labels live in the web UI keyed by these
// slugs. Categories are dish types only - never health, diet, or quality
// classifications. NULL means uncategorized (listed under "All").
// ---------------------------------------------------------------------------

export const RECIPE_CATEGORY_SLUGS = ['soups-stews', 'dumplings', 'tacos-tortillas'] as const;
export type RecipeCategorySlug = (typeof RECIPE_CATEGORY_SLUGS)[number];

export function isRecipeCategorySlug(v: unknown): v is RecipeCategorySlug {
  return typeof v === 'string' && (RECIPE_CATEGORY_SLUGS as readonly string[]).includes(v);
}

export type CategoryFieldParse =
  | { ok: true; present: boolean; value: RecipeCategorySlug | null }
  | { ok: false; error: string };

/** Reads the optional category key out of a submission or MCP argument
 * object. null clears; an unknown slug is rejected, never coerced. */
export function parseCategoryField(input: Record<string, unknown>): CategoryFieldParse {
  if (!('category' in input) || input['category'] === undefined) return { ok: true, present: false, value: null };
  const v = input['category'];
  if (v === null) return { ok: true, present: true, value: null };
  if (!isRecipeCategorySlug(v)) {
    return { ok: false, error: `category must be one of: ${RECIPE_CATEGORY_SLUGS.join(', ')}` };
  }
  return { ok: true, present: true, value: v };
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

  const times = parseTimeFields(sub);
  if (!times.ok) fail('times', times.error);

  const category = parseCategoryField(sub);
  if (!category.ok) fail('category', category.error);

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
    // Ligatures do not decompose under NFD; transliterate them first so
    // "b\u0153uf" becomes "boeuf", not "b-uf".
    .replace(/\u0153/g, 'oe')
    .replace(/\u00e6/g, 'ae')
    .replace(/\u00df/g, 'ss')
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

export function recipePath(country: string, slug: string): string {
  return `${countryPath(country)}recipes/${slug}`;
}

/** Locale-aware recipe path. The country's default locale keeps the
 * unprefixed URL (/{country}/recipes/...); any other registered locale lives
 * at /{country}/{lang}/recipes/... */
export function recipePathFor(country: string, lang: string, slug: string): string {
  const def = defaultLocale(country);
  return !def || lang.toLowerCase() === def
    ? recipePath(country, slug)
    : `${countryPath(country)}${lang.toLowerCase()}/recipes/${slug}`;
}

export interface ParsedPath {
  country: string;
  /** Present only for explicit /{country}/{lang}/ paths of a registered, non-default locale. */
  lang?: string;
  /** Legacy opaque id prefix; present only for the legacy
   * /{country}/recipes/{id}-{slug} shape, never for clean slug-only URLs. */
  id?: string;
  /** Full trailing recipe segment: the public slug on clean URLs, the whole
   * {id}-{slug} segment on legacy URLs. */
  slug?: string;
  /** The slug portion of a legacy {id}-{slug} path; undefined on clean URLs. */
  legacySlug?: string;
}

/** Split a recipe path segment into its clean and legacy readings. Every
 * valid segment yields the full segment as `slug` (the clean-URL reading);
 * segments with a hyphen additionally yield the legacy {id}-{slug} reading.
 * Which reading applies is decided by lookup, not by the regex: the router
 * tries the live slug first, then the legacy id. */
function parseRecipeSegment(country: string, lang: string | undefined, segment: string): ParsedPath | null {
  if (!SLUG_PATTERN.test(segment)) return null;
  const base: ParsedPath = lang === undefined ? { country } : { country, lang };
  const legacy = /^([a-z0-9]+)-([a-z0-9-]+)$/.exec(segment);
  if (legacy) {
    base.id = legacy[1];
    base.slug = segment;
    base.legacySlug = legacy[2];
  } else {
    base.slug = segment;
  }
  return base;
}

/** Parse /{country}/, /{country}/recipes/{slug} and the legacy
 * /{country}/recipes/{id}-{slug} (plus the non-default-locale prefixed
 * variants). Returns null when the country is not registered or the shape
 * does not match. */
export function parsePath(pathname: string): ParsedPath | null {
  const home = /^\/([a-z]{2})\/?$/.exec(pathname);
  if (home) {
    const country = home[1];
    return country && getCountry(country) ? { country } : null;
  }
  const loc = /^\/([a-z]{2})\/([a-z]{2})\/recipes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  if (loc) {
    const [, country, lang, segment] = loc;
    if (!country || !lang || !segment || !getCountry(country)) return null;
    // Only registered, non-default locales have a prefixed URL; the default
    // locale lives at the unprefixed path (no duplicate URLs).
    if (!localesFor(country).includes(lang) || lang === defaultLocale(country)) return null;
    return parseRecipeSegment(country, lang, segment);
  }
  const rec = /^\/([a-z]{2})\/recipes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  if (!rec) return null;
  const [, country, segment] = rec;
  if (!country || !segment || !getCountry(country)) return null;
  return parseRecipeSegment(country, undefined, segment);
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
  /** Structured timing/yield (migration 0004). All nullable: an absent value
   * means "not recorded", never zero. totalMinutes is stored explicitly and
   * is never prep+cook arithmetic - prep and cook can overlap and resting
   * time sits outside both. Translation-invariant: stored once per recipe,
   * shared by every locale. */
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  restMinutes?: number | null;
  totalMinutes?: number | null;
  /** Numeric base yield the serving scaler multiplies from (1x). */
  baseServings?: number | null;
  /** Dish-type category slug (migration 0004); null = uncategorized. */
  category?: RecipeCategorySlug | null;
}

/** Honest imagery classes: a real photo (depicts an actual dish, provenance
 * required), a generated illustration (labeled, never presented as the
 * cooked result), or a title graphic (text only, no food depiction). */
export type RecipeImageStyle = 'photo' | 'illustration' | 'graphic';

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

/** A served recipe image reference: absolute URL on this origin plus the
 * honest-imagery label. Only rights-confirmed (cleared_at) images are ever
 * resolved into these refs. */
export interface RecipeImageRef {
  url: string;
  style: RecipeImageStyle;
}

export interface RecipePage {
  recipe: Recipe;
  locale: RecipeLocale;
  source: Source;
  /** Rights-tracked hero image (recipe_images, migration 0004), already
   * resolved to an absolute serving URL. null when none is set; renderers
   * fall back to the title graphic or no image. */
  heroImage?: RecipeImageRef | null;
  /** Rights-tracked step images (migration 0004), aligned to the locale's
   * steps array by 0-based index; null entries are steps without an image.
   * Same serving URL shape as heroImage. */
  stepImages?: (RecipeImageRef | null)[];
}
export * from './units';
export * from './render';
export * from './translation';
export * from './accountStrings';
export * from './canonical';
