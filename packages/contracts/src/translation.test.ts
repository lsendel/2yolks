import { describe, it, expect } from 'vitest';
import { requestTranslation, type TranslationSource, type TranslationProvider } from './index';
const src: TranslationSource = { recipeId: 'r1', country: 'us', lang: 'en', title: 'Soup', intro: null, ingredients: ['1 tbsp oil', '2 eggs'], steps: ['Cook 5 minutes.'] };
describe('translation adapter is fail-closed', () => {
  it('refuses without a provider', async () => {
    const r = await requestTranslation(src, 'es');
    expect(r.ok).toBe(false);
  });
  it('refuses unsupported and same language', async () => {
    const p: TranslationProvider = { translate: async () => { throw new Error('should not run'); } };
    expect((await requestTranslation(src, 'de', p)).ok).toBe(false);
    expect((await requestTranslation(src, 'en', p)).ok).toBe(false);
  });
  it('turns provider errors into refusals', async () => {
    const r = await requestTranslation(src, 'es', { translate: async () => { throw new Error('boom'); } });
    expect(r.ok).toBe(false);
  });
  it('rejects changed numbers and dropped allergens', async () => {
    const bad = await requestTranslation(src, 'es', { translate: async () => ({ title: 'Sopa', intro: null, ingredients: ['1 cucharada de aceite', '2 tomates'], steps: ['Cocina 10 minutos.'] }) });
    expect(bad.ok).toBe(false);
  });
  it('good output is only ever an unreviewed machine draft', async () => {
    const r = await requestTranslation(src, 'es', { translate: async () => ({ title: 'Sopa', intro: null, ingredients: ['1 tbsp aceite', '2 huevos'], steps: ['Cocina 5 minutos.'] }) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.status).toBe('draft');
      expect(r.draft.translationMethod).toBe('machine');
      expect(r.draft.translationReviewedBy).toBeNull();
      expect(r.draft.translationReviewerKind).toBeNull();
    }
  });
});
