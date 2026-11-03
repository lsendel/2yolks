// Display-side unit conversion and scaling. Pure functions so every variant
// (system x multiplier) can be rendered on the server and tested; the browser
// only swaps pre-rendered text. No model is involved.
import { parseIngredient, formatQty } from './index';
import { convertQuantity, unitInfo, renderTemps, type IngredientEntry, type UnitSystem, type StructuredIngredient } from './units';

export const SCALE_MULTIPLIERS = [0.5, 1, 2, 3] as const;
export const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'us'];

/** Written unit -> canonical unit key. Lowercase, no trailing dot. */
const ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g', gramo: 'g', gramos: 'g', gr: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', l: 'l', litro: 'l', litros: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz', onza: 'oz', onzas: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', libra: 'lb', libras: 'lb', livre: 'lb',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', cucharadita: 'tsp', cucharaditas: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', cucharada: 'tbsp', cucharadas: 'tbsp',
  cup: 'cup', cups: 'cup', taza: 'cup', tazas: 'cup', tasse: 'cup', tasses: 'cup',
  qt: 'qt', quart: 'qt', quarts: 'qt',
};

const LABELS: Record<string, Record<string, [string, string]>> = {
  en: {},
  es: { cup: ['taza', 'tazas'], tbsp: ['cucharada', 'cucharadas'], tsp: ['cucharadita', 'cucharaditas'], oz: ['oz', 'oz'], lb: ['lb', 'lb'] },
  fr: { cup: ['tasse', 'tasses'], tbsp: ['c. \u00e0 soupe', 'c. \u00e0 soupe'], tsp: ['c. \u00e0 caf\u00e9', 'c. \u00e0 caf\u00e9'] },
};

function label(unit: string, lang: string, qty = 1): string {
  if (unit === 'cup' && qty > 1 && !LABELS[lang]?.cup) return 'cups';
  const l = LABELS[lang]?.[unit];
  if (l) return qty > 1 ? l[1] : l[0];
  return unitInfo(unit)?.label ?? unit;
}

/** Spanish joins a measure and its ingredient with "de" ("2 cucharaditas de sal").
 * Written-out text rows already carry it; structured names do not. */
function joinText(lang: string, text: string): string {
  if (lang !== 'es' || !text) return text;
  return /^(de|del)\s/i.test(text) ? text : `de ${text}`;
}

/** Split a leading unit word off "cups all-purpose flour". */
export function splitUnit(rest: string): { unit: string; after: string; written: string } | null {
  const m = /^([A-Za-z\u00c0-\u00ff]+)\.?\s*(.*)$/.exec(rest);
  if (!m) return null;
  const key = m[1]!.toLowerCase();
  const unit = ALIASES[key];
  if (!unit) return null;
  // "fl oz" and similar two-word units are left as written (never guessed).
  return { unit, after: m[2] ?? '', written: m[1]! };
}

interface Line { qty: number | null; qtyEnd: number | null; unit: string | null; written: string; text: string }

function toLine(entry: IngredientEntry): Line {
  if (typeof entry === 'string') {
    const p = parseIngredient(entry);
    if (p.qty === null) return { qty: null, qtyEnd: null, unit: null, written: '', text: p.rest };
    // A line with another number in it ("1 cup (240 ml)") is never converted.
    const su = /\d/.test(p.rest) ? null : splitUnit(p.rest);
    return su
      ? { qty: p.qty, qtyEnd: p.qtyEnd, unit: su.unit, written: su.written, text: su.after }
      : { qty: p.qty, qtyEnd: p.qtyEnd, unit: null, written: '', text: p.rest };
  }
  const s = entry as StructuredIngredient;
  const text = s.note ? `${s.name}, ${s.note}` : s.name;
  return { qty: s.qty, qtyEnd: s.qtyEnd ?? null, unit: s.unit && unitInfo(s.unit) ? s.unit : null, written: s.unit ?? '', text };
}

function asWritten(l: Line, mult: number, structured = false, lang = 'en'): string {
  if (structured && l.unit) return label(l.unit, lang, (l.qtyEnd ?? l.qty ?? 1) * mult);
  const q = (l.qtyEnd ?? l.qty ?? 1) * mult;
  if (l.unit === 'cup' && /^(cup|taza|tasse)$/i.test(l.written)) return label('cup', /^taza$/i.test(l.written) ? 'es' : /^tasse$/i.test(l.written) ? 'fr' : 'en', q);
  return l.written || label(l.unit!, 'en');
}

function fmtRange(a: number, b: number | null, dec = false): string {
  const f = (n: number) => (dec ? String(Math.round(n * 100) / 100) : formatQty(n));
  return b !== null ? `${f(a)}-${f(b)}` : f(a);
}

/** One ingredient line in one unit system at one scale. Converts only within
 * a dimension and only when the written unit is in the other system. */
export function renderIngredient(entry: IngredientEntry, lang: string, system: UnitSystem, mult = 1): string {
  const l = toLine(entry);
  if (l.qty === null) return l.text;
  if (!l.unit) {
    const unitPart = l.written && typeof entry !== 'string' ? ` ${l.written}` : '';
    return `${fmtRange(l.qty * mult, l.qtyEnd === null ? null : l.qtyEnd * mult)}${unitPart} ${l.text}`.trim();
  }
  const a = convertQuantity({ qty: l.qty * mult, unit: l.unit }, system);
  if (!a) return `${fmtRange(l.qty * mult, l.qtyEnd === null ? null : l.qtyEnd * mult)} ${asWritten(l, mult, typeof entry !== 'string', lang)} ${typeof entry !== 'string' ? joinText(lang, l.text) : l.text}`.trim();
  if (l.qtyEnd !== null) {
    const b = convertQuantity({ qty: l.qtyEnd * mult, unit: l.unit }, system)!;
    if (b.unit === a.unit) return `${fmtRange(a.qty, b.qty, system === 'metric')} ${label(a.unit, lang, b.qty)} ${typeof entry !== 'string' ? joinText(lang, l.text) : l.text}`.trim();
    // Range straddles two display units: keep the unit as written.
    return `${fmtRange(l.qty * mult, l.qtyEnd * mult)} ${l.written} ${l.text}`.trim();
  }
  return `${system === 'metric' ? fmtRange(a.qty, null, true) : formatQty(a.qty)} ${label(a.unit, lang, a.qty)} ${typeof entry !== 'string' ? joinText(lang, l.text) : l.text}`.trim();
}

export function isConvertible(entry: IngredientEntry, system: UnitSystem): boolean {
  const l = toLine(entry);
  return l.qty !== null && l.unit !== null && unitInfo(l.unit)!.system !== system;
}

/** Steps: only tokens are rendered ({t:350F}, {i:ref}); free text is never
 * rewritten, because a model-free regex over prose would be a guess. */
export function renderStep(step: string, entries: IngredientEntry[], lang: string, system: UnitSystem, mult = 1): string {
  const byRef = new Map<string, StructuredIngredient>();
  for (const e of entries) if (typeof e !== 'string') byRef.set(e.ref, e);
  const withIng = step.replace(/\{i:([a-z0-9-]+)\}/g, (_m, ref: string) => {
    const e = byRef.get(ref);
    if (!e) return '';
    const full = renderIngredient({ ...e, name: '', note: undefined }, lang, system, mult);
    return full.trim();
  });
  return renderTemps(withIng, system);
}

export function hasStepTokens(steps: string[]): boolean {
  return steps.some((s) => /\{[ti]:/.test(s));
}

export type Variants = Record<UnitSystem, Record<string, string>>;

export function ingredientVariants(entry: IngredientEntry, lang: string, mults: readonly number[]): Variants {
  const v: Variants = { metric: {}, us: {} };
  for (const s of UNIT_SYSTEMS) for (const m of mults) v[s][String(m)] = renderIngredient(entry, lang, s, m);
  return v;
}

export function stepVariants(step: string, entries: IngredientEntry[], lang: string, mults: readonly number[]): Variants {
  const v: Variants = { metric: {}, us: {} };
  for (const s of UNIT_SYSTEMS) for (const m of mults) v[s][String(m)] = renderStep(step, entries, lang, s, m);
  return v;
}

/** Per-country default. US customary only where the market uses it. */
export function defaultUnitSystem(country: string): UnitSystem {
  return country === 'us' ? 'us' : 'metric';
}
