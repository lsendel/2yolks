// Deterministic recipe text and JSON-LD parsers. No AI, no network.

export type ParsedRecipe = {
  title: string;
  intro: string;
  ingredients: string[];
  steps: string[];
  prepMinutes?: number;
  cookMinutes?: number;
  servings?: number;
  authorName?: string;
  warnings: string[];
};

const ING_HEAD = /^(ingredients?|ingredientes|ingr[ée]dients)\s*:?\s*$/i;
const STEP_HEAD = /^(instructions?|directions?|method|steps?|preparation|preparaci[óo]n|instrucciones|pr[ée]paration|[ée]tapes|procedimiento)\s*:?\s*$/i;
const MAX_ITEMS = 80;
const MAX_ITEM_LEN = 1000;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LEN);
const stripBullet = (s: string) => s.replace(/^\s*(?:[-*•·▪◦]|\d{1,3}[.)])\s*/, '').trim();

export function parseRecipeText(text: string): ParsedRecipe {
  const warnings: string[] = [];
  const lines = text.replace(/\r/g, '').slice(0, 60_000).split('\n').map((l) => l.trim());
  let mode: 'head' | 'ing' | 'step' = 'head';
  const head: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (ING_HEAD.test(line.replace(/^#+\s*/, ''))) { mode = 'ing'; continue; }
    if (STEP_HEAD.test(line.replace(/^#+\s*/, ''))) { mode = 'step'; continue; }
    if (mode === 'head') head.push(line);
    else if (mode === 'ing') ingredients.push(clean(stripBullet(line)));
    else steps.push(clean(stripBullet(line)));
  }
  const title = clean((head[0] ?? '').replace(/^#+\s*/, '')).slice(0, 200);
  const intro = clean(head.slice(1).join(' ')).slice(0, 2000);
  if (!title) warnings.push('No title found: the first line should be the recipe name.');
  if (ingredients.length === 0) warnings.push('No ingredients found: add a line that says "Ingredients" followed by one per line.');
  if (steps.length === 0) warnings.push('No steps found: add a line that says "Instructions" followed by one step per line.');
  return {
    title,
    intro,
    ingredients: ingredients.filter(Boolean).slice(0, MAX_ITEMS),
    steps: steps.filter(Boolean).slice(0, MAX_ITEMS),
    warnings,
  };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const plain = (v: unknown): string => (typeof v === 'string' ? clean(decode(v.replace(/<[^>]*>/g, ' '))) : '');

/** ISO-8601 duration (PT1H30M) to whole minutes. */
export function isoMinutes(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(v.trim());
  if (!m) return undefined;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return mins > 0 && mins <= 20_000 ? mins : undefined;
}

function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipeNode(n, depth + 1); if (r) return r; }
    return null;
  }
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return o;
  return findRecipeNode(o['@graph'], depth + 1);
}

function instructionSteps(v: unknown, out: string[], depth = 0): void {
  if (depth > 4 || out.length >= MAX_ITEMS) return;
  if (typeof v === 'string') {
    for (const part of v.split(/\n+/)) { const s = plain(part); if (s) out.push(s); }
  } else if (Array.isArray(v)) {
    for (const x of v) instructionSteps(x, out, depth + 1);
  } else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o['itemListElement']) instructionSteps(o['itemListElement'], out, depth + 1);
    else instructionSteps(o['text'] ?? o['name'], out, depth + 1);
  }
}

export function parseJsonLdRecipe(html: string): ParsedRecipe | null {
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(html)) && n++ < 30) {
    let json: unknown;
    try { json = JSON.parse(m[1]!.trim()); } catch { continue; }
    const r = findRecipeNode(json);
    if (!r) continue;
    const ingredients = (Array.isArray(r['recipeIngredient']) ? r['recipeIngredient'] : [])
      .map(plain).filter(Boolean).slice(0, MAX_ITEMS);
    const steps: string[] = [];
    instructionSteps(r['recipeInstructions'], steps);
    const author = r['author'];
    const authorName = plain(Array.isArray(author) ? (author[0] as Record<string, unknown>)?.['name'] ?? author[0] : typeof author === 'object' && author ? (author as Record<string, unknown>)['name'] : author) || undefined;
    const yieldRaw = Array.isArray(r['recipeYield']) ? r['recipeYield'][0] : r['recipeYield'];
    const servings = Number(/\d+(?:\.\d+)?/.exec(String(yieldRaw ?? ''))?.[0]);
    const warnings: string[] = [];
    if (ingredients.length === 0) warnings.push('The page listed no ingredients.');
    if (steps.length === 0) warnings.push('The page listed no steps.');
    const out: ParsedRecipe = {
      title: plain(r['name']).slice(0, 200),
      intro: plain(r['description']).slice(0, 2000),
      ingredients,
      steps: steps.slice(0, MAX_ITEMS),
      warnings,
    };
    const prep = isoMinutes(r['prepTime']); if (prep) out.prepMinutes = prep;
    const cook = isoMinutes(r['cookTime']); if (cook) out.cookMinutes = cook;
    if (Number.isFinite(servings) && servings > 0 && servings <= 1000) out.servings = servings;
    if (authorName) out.authorName = authorName.slice(0, 200);
    return out;
  }
  return null;
}
