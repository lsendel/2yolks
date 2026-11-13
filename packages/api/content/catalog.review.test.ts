import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  SLUG_PATTERN,
  checkAllergens,
  checkStructuredTranslation,
  checkTranslation,
  ingredientText,
  renderIngredient,
  renderStep,
} from '@2yolks/contracts';
import doc from './catalog.translation-drafts.json' with { type: 'json' };
import review from './catalog.translation-review.json' with { type: 'json' };

type Draft = (typeof doc.drafts)[number];

const hashOf = (d: Draft): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        title: d.title,
        intro: d.intro,
        ingredients: d.ingredients,
        steps: d.steps,
      }),
    )
    .digest('hex');

describe('catalog translation drafts & review contract', () => {
  it('covers all 210 target locales with unique valid slugs and clean structured names', () => {
    expect(doc.drafts).toHaveLength(210);
    const seenSlugs = new Set<string>();
    const seenKeys = new Set<string>();

    for (const d of doc.drafts) {
      const enabledLangs = LOCALES[d.country as keyof typeof LOCALES] as readonly string[] | undefined;
      expect(enabledLangs?.includes(d.lang)).toBe(true);
      expect(d.title.trim().length).toBeGreaterThan(2);
      expect(d.slug).toMatch(SLUG_PATTERN);

      const key = `${d.recipe_id}:${d.country}:${d.lang}`;
      expect(seenKeys.has(key)).toBe(false);
      seenKeys.add(key);

      const slugKey = `${d.country}:${d.lang}:${d.slug}`;
      expect(seenSlugs.has(slugKey)).toBe(false);
      seenSlugs.add(slugKey);

      for (const ing of d.ingredients) {
        if (typeof ing === 'object' && ing !== null) {
          expect(ing.name).not.toMatch(/^(?:de\s+|d['’])/i);
        }
        for (const sys of ['metric', 'us'] as const) {
          const rendered = renderIngredient(ing as never, d.lang as 'en' | 'es' | 'fr', sys);
          expect(rendered).not.toMatch(/\b(?:de de|d['’]de)\b/i);
          expect(rendered).not.toMatch(/^0\s+/);
        }
      }

      for (const step of d.steps) {
        for (const sys of ['metric', 'us'] as const) {
          const rendered = renderStep(step, d.lang as 'en' | 'es' | 'fr', sys, d.ingredients as never);
          expect(rendered).not.toMatch(/\{[a-z]+:[^}]+\}/i);
        }
      }
    }
  });

  it('keeps tokens, numbers, structured quantities, and allergens consistent across target locales per recipe', () => {
    const byRecipe = new Map<string, Draft[]>();
    for (const d of doc.drafts) {
      const list = byRecipe.get(d.recipe_id) ?? [];
      list.push(d);
      byRecipe.set(d.recipe_id, list);
    }

    expect(byRecipe.size).toBe(105);
    for (const [recipeId, list] of byRecipe) {
      expect(list.length, `expected 2 target locales for ${recipeId}`).toBe(2);
      const [a, b] = list;

      const stepCheck = checkTranslation({ steps: a.steps }, { steps: b.steps });
      expect(stepCheck.problems, `${recipeId} ${a.lang}/${b.lang} steps`).toEqual([]);

      const structCheck = checkStructuredTranslation(a.ingredients as never, b.ingredients as never);
      expect(structCheck.problems, `${recipeId} ${a.lang}/${b.lang} ingredients`).toEqual([]);

      // Mask French culinary words (`bœuf` contains `œuf`, `laitue` contains `lait`)
      // before running symmetric sibling `checkAllergens` substring comparisons.
      const stripFrSubstrings = (s: string) => s.replace(/\bbœuf\b|\blaitue\b/gi, ' ');
      const textA = stripFrSubstrings(ingredientText(a.ingredients as never));
      const textB = stripFrSubstrings(ingredientText(b.ingredients as never));

      const allergenAB = checkAllergens(textA, textB);
      expect(allergenAB.problems, `${recipeId} ${a.lang}->${b.lang} allergens`).toEqual([]);

      const allergenBA = checkAllergens(textB, textA);
      expect(allergenBA.problems, `${recipeId} ${b.lang}->${a.lang} allergens`).toEqual([]);
    }
  });

  it('binds every draft SHA-256 content hash to an honest passing agent review record', () => {
    expect(review.reviewer).toMatch(/not a human or native-speaker review/);
    expect(review.findings.length).toBeGreaterThan(0);
    expect(review.reviews).toHaveLength(doc.drafts.length);

    for (const d of doc.drafts) {
      const entry = review.reviews.find(
        (r) => r.recipe_id === d.recipe_id && r.country === d.country && r.lang === d.lang,
      );
      expect(entry, `review missing for ${d.recipe_id} ${d.country}/${d.lang}`).toBeDefined();
      expect(entry?.reviewer_kind).toBe('agent');
      expect(entry?.result).toBe('pass');
      expect(entry?.content_sha256).toBe(hashOf(d));
    }
  });
});
