import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkTranslation, checkAllergens, checkStructuredTranslation, ingredientText, renderIngredient, localesFor } from '@2yolks/contracts';

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const src = new Map<string, any>(read('./wave1.structured.json').recipes.map((r: any) => [r.id, r]));
const drafts: any[] = read('./wave1.translation-drafts.json').drafts;

describe('wave1 translation drafts (unpublished, assistant-authored)', () => {
  it('covers every recipe in the two other languages of its country set (en/es/fr)', () => {
    expect(drafts.length).toBe(10);
    for (const r of src.values()) {
      const langs = drafts.filter((d) => d.recipe_id === r.id).map((d) => d.lang).sort();
      expect(langs).toEqual(['en', 'es', 'fr'].filter((l) => l !== r.lang));
    }
  });
  it('never carries review, publication or reviewer claims', () => {
    for (const d of drafts) {
      expect(d.status).toBe('draft');
      expect(d.translation_method).toBe('machine');
      expect(d.translation_reviewed_by).toBeNull();
      expect(d.translation_reviewed_at).toBeNull();
      expect(d.translation_reviewer_kind).toBeNull();
      expect(localesFor(d.country)).toContain(d.lang);
      expect(d.intro).toMatch(/not yet tested|aún no probado|pas encore testé/);
    }
  });
  it('keeps numbers, temperatures, allergens and structure identical to the source', () => {
    for (const d of drafts) {
      const s = src.get(d.recipe_id);
      expect(checkTranslation({ steps: s.steps }, { steps: d.steps }), `${d.recipe_id}.${d.lang} steps`).toEqual({ ok: true, problems: [] });
      expect(checkStructuredTranslation(s.ingredients, d.ingredients), `${d.recipe_id}.${d.lang} ingredients`).toEqual({ ok: true, problems: [] });
      expect(checkAllergens(ingredientText(s.ingredients), ingredientText(d.ingredients)).ok, `${d.recipe_id}.${d.lang} allergens`).toBe(true);
    }
  });
  it('actually differs from the source text (not a copy) and metric output never uses fractions', () => {
    for (const d of drafts) {
      const s = src.get(d.recipe_id);
      expect(d.title).not.toBe(s.title);
      expect(d.steps.every((t: string, i: number) => t !== s.steps[i])).toBe(true);
      for (const e of d.ingredients) {
        const m = renderIngredient(e, d.lang, 'metric');
        expect(m).not.toMatch(/^[\d\s]*[½¼¾⅓⅔⅛⅜⅝⅞]\s*(ml|g|kg|l)\b/);
        expect(m).not.toMatch(/^0\s/);
      }
    }
  });
});

import { slugify } from '@2yolks/contracts';
describe('draft slugs', () => {
  it('equal slugify(title), are clean ASCII, and never collide within country+lang', () => {
    const seen = new Set<string>();
    for (const d of drafts) {
      expect(d.slug).toBe(slugify(d.title));
      expect(d.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      const key = `${d.country}/${d.lang}/${d.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // no collision with the live source slugs either
    for (const s of src.values()) expect(seen.has(`${s.country}/${s.lang}/${s.slug}`)).toBe(false);
    expect(slugify('Tacos de bœuf æther')).toBe('tacos-de-boeuf-aether');
  });
});

describe('drafts are aligned with the structured (live) source', () => {
  it('structured source equals wave1.json text-for-text via the prepared diff, and drafts carry the same ref/qty/unit', () => {
    const orig = new Map<string, any>(read('./wave1.json').recipes.map((r: any) => [r.id, r]));
    const diff = read('./wave1.structured-diff.json');
    for (const r of src.values()) {
      const conv = new Map<string, any>(diff.recipes.find((x: any) => x.id === r.id).convert.map((c: any) => [c.before, c.after]));
      orig.get(r.id).ingredients.forEach((o: string, i: number) => expect(r.ingredients[i]).toEqual(conv.get(o) ?? o));
      for (const d of drafts.filter((x) => x.recipe_id === r.id)) {
        r.ingredients.forEach((s: any, i: number) => {
          const t = d.ingredients[i];
          if (typeof s === 'string') return expect(typeof t).toBe('string');
          expect(typeof t).toBe('object');
          expect({ ref: t.ref, qty: t.qty, unit: t.unit, qtyEnd: t.qtyEnd }).toEqual({ ref: s.ref, qty: s.qty, unit: s.unit, qtyEnd: s.qtyEnd });
          expect(Boolean(t.note)).toBe(Boolean(s.note));
        });
      }
    }
  });
  it('structured draft rows render with localized wording (de / d\u2019)', () => {
    const fr = drafts.find((d) => d.recipe_id === 'w1golumpki' && d.lang === 'fr');
    const oil = renderIngredient(fr.ingredients[0], 'fr', 'us');
    expect(oil).toMatch(/^1 c\. à soupe d’huile d’olive$/);
    const es = drafts.find((d) => d.recipe_id === 'w1golumpki' && d.lang === 'es');
    expect(renderIngredient(es.ingredients[0], 'es', 'us')).toBe('1 cucharada de aceite de oliva');
  });
});
