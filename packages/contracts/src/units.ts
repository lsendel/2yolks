// Deterministic unit conversion and translation QA for recipes.
// No model is involved. "us" means US customary (cups, tbsp, tsp, fl oz, oz, lb, F).
// It is not UK imperial: a UK pint or fluid ounce is a different size.
// Volume is never converted to mass (or back): that needs a per-ingredient
// density, which we do not store. A line keeps the unit it was written in,
// and only converts within its own dimension.

export type UnitSystem = 'metric' | 'us';
export type Dimension = 'mass' | 'volume' | 'count';

interface UnitDef { dim: Dimension; system: UnitSystem | 'any'; toBase: number; label: string }

// Base units: gram, millilitre.
const UNITS: Record<string, UnitDef> = {
  g: { dim: 'mass', system: 'metric', toBase: 1, label: 'g' },
  kg: { dim: 'mass', system: 'metric', toBase: 1000, label: 'kg' },
  oz: { dim: 'mass', system: 'us', toBase: 28.349523125, label: 'oz' },
  lb: { dim: 'mass', system: 'us', toBase: 453.59237, label: 'lb' },
  ml: { dim: 'volume', system: 'metric', toBase: 1, label: 'ml' },
  l: { dim: 'volume', system: 'metric', toBase: 1000, label: 'L' },
  tsp: { dim: 'volume', system: 'us', toBase: 4.92892159375, label: 'tsp' },
  tbsp: { dim: 'volume', system: 'us', toBase: 14.78676478125, label: 'tbsp' },
  floz: { dim: 'volume', system: 'us', toBase: 29.5735295625, label: 'fl oz' },
  cup: { dim: 'volume', system: 'us', toBase: 236.5882365, label: 'cup' },
  qt: { dim: 'volume', system: 'us', toBase: 946.352946, label: 'qt' },
};

export function unitInfo(unit: string): UnitDef | undefined {
  return UNITS[unit];
}

export interface Quantity { qty: number; unit: string }

/** Convert within the same dimension to the target system, or null when the
 * unit is unknown, a count, or already in the target system. */
export function convertQuantity(q: Quantity, to: UnitSystem): Quantity | null {
  const u = UNITS[q.unit];
  if (!u || u.system === to) return null;
  const base = q.qty * u.toBase;
  if (u.dim === 'mass') {
    return to === 'metric' ? roundMetric(base, 'g', 'kg', 1000) : roundUsMass(base);
  }
  return to === 'metric' ? roundMetric(base, 'ml', 'l', 1000) : roundUsVolume(base);
}

function sig(n: number): number {
  if (n >= 100) return Math.round(n / 5) * 5;
  if (n >= 10) return Math.round(n);
  return Math.round(n * 2) / 2;
}

function roundMetric(base: number, small: string, big: string, factor: number): Quantity {
  if (base >= factor) return { qty: Math.round((base / factor) * 100) / 100, unit: big };
  return { qty: sig(base), unit: small };
}

function roundUsMass(g: number): Quantity {
  const lb = g / UNITS.lb!.toBase;
  if (lb >= 0.97) return { qty: Math.round(lb * 4) / 4, unit: 'lb' };
  return { qty: Math.round((g / UNITS.oz!.toBase) * 2) / 2, unit: 'oz' };
}

function roundUsVolume(ml: number): Quantity {
  const tsp = ml / UNITS.tsp!.toBase;
  if (tsp < 3) return { qty: Math.round(tsp * 8) / 8, unit: 'tsp' };
  const tbsp = ml / UNITS.tbsp!.toBase;
  if (tbsp < 4) return { qty: Math.round(tbsp * 4) / 4, unit: 'tbsp' };
  const cup = ml / UNITS.cup!.toBase;
  return { qty: Math.round(cup * 8) / 8, unit: 'cup' };
}

export function fahrenheitToCelsius(f: number): number {
  // Ceil: a converted temperature is never below the exact value, so a
  // minimum-doneness threshold is never rounded down into an unsafe number.
  return Math.ceil(((f - 32) * 5) / 9 - 1e-9);
}
export function celsiusToFahrenheit(c: number): number {
  return Math.ceil((c * 9) / 5 + 32 - 1e-9);
}

// ---------------------------------------------------------------------------
// Structured ingredients. Stored as JSON objects inside ingredients_json
// (plain strings stay valid). Steps reference ingredient amounts and
// temperatures by token so the numbers cannot drift from the ingredient list:
//   {i:oil}      amount of the ingredient with ref "oil", e.g. "1 tbsp"
//   {t:160F}     a temperature written in F; shows "160 F" or "71 C"
//   {t:71C}      a temperature written in C
// ---------------------------------------------------------------------------

export interface StructuredIngredient {
  ref: string;
  qty: number | null;
  qtyEnd?: number | null;
  unit?: string;
  name: string;
  note?: string;
}

export function isStructured(v: unknown): v is StructuredIngredient {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.ref === 'string' && /^[a-z0-9-]+$/.test(o.ref) && typeof o.name === 'string' &&
    (o.qty === null || typeof o.qty === 'number') &&
    (o.unit === undefined || typeof o.unit === 'string');
}

export function scaleQuantity(q: Quantity, mult: number): Quantity {
  return { qty: q.qty * mult, unit: q.unit };
}

/** Temperature tokens in free text. */
const TEMP_TOKEN = /\{t:(\d+(?:\.\d+)?)([FC])\}/g;
const ING_TOKEN = /\{i:([a-z0-9-]+)\}/g;

export function renderTemps(text: string, system: UnitSystem): string {
  return text.replace(TEMP_TOKEN, (_m, n: string, scale: string) => {
    const v = Number(n);
    if (system === 'us') return `${scale === 'F' ? v : celsiusToFahrenheit(v)}\u00b0F`;
    return `${scale === 'C' ? v : fahrenheitToCelsius(v)}\u00b0C`;
  });
}

/** Tokens that point at no ingredient are an authoring error. */
export function unknownRefs(text: string, ingredients: StructuredIngredient[]): string[] {
  const refs = new Set(ingredients.map((i) => i.ref));
  const out: string[] = [];
  for (const m of text.matchAll(ING_TOKEN)) if (!refs.has(m[1]!)) out.push(m[1]!);
  return out;
}

// ---------------------------------------------------------------------------
// Translation quality gate. Any translator (human, local model, or an agent
// through MCP) must pass this before a translated version can be published.
// It checks things a translation must never change: every number, every
// token, and food-safety / allergen terms. Meaning and fluency still need a
// reviewer; passing this gate does not mean the text is good.
// ---------------------------------------------------------------------------

export interface TranslationCheck { ok: boolean; problems: string[] }

function numbersIn(s: string): string[] {
  return (s.replace(/\{[it]:[^}]+\}/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
}
function tokensIn(s: string): string[] {
  return (s.match(/\{[it]:[^}]+\}/g) ?? []).sort();
}

export function checkTranslation(source: { steps: string[] }, translated: { steps: string[] }): TranslationCheck {
  const problems: string[] = [];
  if (source.steps.length !== translated.steps.length) {
    problems.push(`step count differs (${source.steps.length} vs ${translated.steps.length})`);
    return { ok: false, problems };
  }
  source.steps.forEach((s, i) => {
    const t = translated.steps[i]!;
    if (JSON.stringify(tokensIn(s)) !== JSON.stringify(tokensIn(t))) problems.push(`step ${i + 1}: amount/temperature tokens changed`);
    if (JSON.stringify(numbersIn(s)) !== JSON.stringify(numbersIn(t))) problems.push(`step ${i + 1}: numbers changed (times, counts)`);
  });
  return { ok: problems.length === 0, problems };
}

/** Terms that must survive translation when present in the source. */
const ALLERGEN_GROUPS: string[][] = [
  ['peanut', 'cacahuate', 'cacahu\u00e8te', 'arachide'],
  ['egg', 'huevo', '\u0153uf', 'oeuf'],
  ['milk', 'leche', 'lait'],
  ['wheat', 'trigo', 'bl\u00e9'],
  ['soy', 'soya', 'soja'],
  ['shrimp', 'camar\u00f3n', 'crevette'],
  ['sesame', 's\u00e9samo', 's\u00e9same', 'ajonjol\u00ed'],
];

/** Allergen terms found in the source ingredient text must appear (in any
 * supported language) in the translated ingredient text. */
export function checkAllergens(sourceIngredientText: string, translatedIngredientText: string): TranslationCheck {
  const problems: string[] = [];
  const src = sourceIngredientText.toLowerCase();
  const dst = translatedIngredientText.toLowerCase();
  for (const group of ALLERGEN_GROUPS) {
    if (group.some((w) => src.includes(w)) && !group.some((w) => dst.includes(w))) {
      problems.push(`allergen term missing in translation: ${group[0]}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

export type IngredientEntry = string | StructuredIngredient;

export function ingredientText(entries: IngredientEntry[]): string {
  return entries.map((e) => (typeof e === 'string' ? e : `${e.name} ${e.note ?? ''}`)).join(' ; ');
}

/** For structured rows the canonical meaning (ref, qty, qtyEnd, unit) must be
 * identical in a translation. Only name and note may change. Plain-string
 * rows are compared by their numbers (floor check). */
export function checkStructuredTranslation(source: IngredientEntry[], translated: IngredientEntry[]): TranslationCheck {
  const problems: string[] = [];
  if (source.length !== translated.length) {
    return { ok: false, problems: [`ingredient count differs (${source.length} vs ${translated.length})`] };
  }
  source.forEach((s, i) => {
    const t = translated[i]!;
    if (typeof s === 'string' || typeof t === 'string') {
      if (typeof s !== typeof t) { problems.push(`ingredient ${i + 1}: structured and plain forms differ`); return; }
      if (JSON.stringify(numbersIn(s as string)) !== JSON.stringify(numbersIn(t as string))) problems.push(`ingredient ${i + 1}: numbers changed`);
      return;
    }
    if (s.ref !== t.ref) problems.push(`ingredient ${i + 1}: ref changed`);
    if (s.qty !== t.qty || (s.qtyEnd ?? null) !== (t.qtyEnd ?? null)) problems.push(`ingredient ${i + 1}: quantity changed`);
    if ((s.unit ?? '') !== (t.unit ?? '')) problems.push(`ingredient ${i + 1}: unit changed`);
  });
  return { ok: problems.length === 0, problems };
}
