import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderRecipe } from '@2yolks/web/server';

const drafts: any[] = JSON.parse(readFileSync(new URL('./wave1.translation-drafts.json', import.meta.url), 'utf8')).drafts;
const d = drafts.find((x) => x.recipe_id === 'w1golumpki' && x.lang === 'fr');
const page = (over: Record<string, unknown>) =>
  ({
    recipe: { id: d.recipe_id, testedAt: null, testedBy: null, sourceId: 's', originCountry: null, imageKey: null },
    source: { id: 's', name: '2yolks', url: '/about', license: 'original', clearedAt: '2026-11-01', kind: 'original' },
    locale: {
      recipeId: d.recipe_id, country: d.country, lang: d.lang, title: d.title, slug: d.slug, intro: d.intro,
      ingredientsJson: JSON.stringify(d.ingredients), stepsJson: JSON.stringify(d.steps), status: 'published',
      translationOf: 'us/en', translationMethod: 'machine', translationReviewedAt: '2026-11-03', translationReviewedBy: 'agent', translationReviewerKind: 'agent', ...over,
    },
  }) as any;
const alts = [{ hreflang: 'en-US', href: 'https://2yolks.com/us/recipes/w1golumpki-golumpki-soup' }, { hreflang: 'fr-US', href: 'https://2yolks.com/us/fr/recipes/w1golumpki-x' }];

describe('machine-translation label on translated pages', () => {
  it('shows an honest label, the pin image and the untested note on an agent-reviewed machine translation', () => {
    const html = renderRecipe(page({}), alts);
    expect(html).toContain('class="machine-note"');
    expect(html).toContain('non relue par un locuteur natif');
    expect(html).toContain('/img/pin/w1golumpki.fr.png');
    expect(html).toContain('Pas encore test');
  });
  it('shows no machine label on an original-language page', () => {
    const html = renderRecipe(page({ translationOf: null, translationMethod: null, translationReviewerKind: null }), alts);
    expect(html).not.toContain('class="machine-note"');
  });
  it('drops the label only for a human reviewer', () => {
    expect(renderRecipe(page({ translationReviewerKind: 'human' }), alts)).not.toContain('class="machine-note"');
    expect(renderRecipe(page({ translationReviewerKind: null }), alts)).toContain('class="machine-note"');
  });
});

describe('recipe route passes translation provenance to the renderer', () => {
  it('maps every translation field from the DB row into the page locale (the label depends on it)', () => {
    const src = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    for (const f of ['translationOf', 'translationMethod', 'translationReviewedAt', 'translationReviewedBy', 'translationReviewerKind']) {
      expect(src, f).toContain(`${f}: canonical.recipe_locales.${f}`);
    }
  });
});
