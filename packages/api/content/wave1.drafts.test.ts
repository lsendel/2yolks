import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkTranslation, checkAllergens, checkStructuredTranslation, ingredientText, renderIngredient, localesFor } from '@2yolks/contracts';

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const src = new Map<string, any>(read('./wave1.json').recipes.map((r: any) => [r.id, r]));
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
