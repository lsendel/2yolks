import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  getCountry,
  waveCountries,
  defaultLocale,
  parsePath,
  countryPath,
  recipePath,
  slugify,
  uiStrings,
  validateRecipeSubmission,
  parseIngredient,
  formatQty,
} from './index';

describe('country registry', () => {
  it('seeds 60 routing countries from the directory receipt', () => {
    expect(COUNTRIES).toHaveLength(60);
  });
  it('marks us and mx as wave 1', () => {
    expect(waveCountries(1).map((c) => c.code).sort()).toEqual(['mx', 'us']);
  });
  it('resolves countries case-insensitively', () => {
    expect(getCountry('US')?.name).toBe('United States');
    expect(getCountry('zz')).toBeUndefined();
  });
});

describe('slug table', () => {
  it('builds /{country}/recipes/{id}-{slug} paths with a stable id', () => {
    expect(recipePath('mx', 'r1', 'huevos-rancheros')).toBe('/mx/recipes/r1-huevos-rancheros');
    expect(countryPath('us')).toBe('/us/');
  });
  it('parses country homes and recipe paths', () => {
    expect(parsePath('/us/')).toEqual({ country: 'us', id: undefined, slug: undefined });
    expect(parsePath('/mx')).toEqual({ country: 'mx', id: undefined, slug: undefined });
    expect(parsePath('/mx/recipes/r1-huevos-rancheros')).toEqual({
      country: 'mx',
      id: 'r1',
      slug: 'huevos-rancheros',
    });
  });
  it('rejects unregistered countries and malformed paths', () => {
    expect(parsePath('/zz/')).toBeNull();
    expect(parsePath('/us/recipes/')).toBeNull();
    expect(parsePath('/us/other/x')).toBeNull();
  });
  it('slugifies titles with accents and punctuation', () => {
    expect(slugify('Huevos a la Mexicana!')).toBe('huevos-a-la-mexicana');
  });
  it('exposes default locales for wave 1', () => {
    expect(defaultLocale('us')).toBe('en');
    expect(defaultLocale('mx')).toBe('es');
  });
});

describe('ui strings', () => {
  it('localizes recipe page chrome', () => {
    expect(uiStrings('es').ingredients).toBe('Ingredientes');
    expect(uiStrings('en').ingredients).toBe('Ingredients');
    expect(uiStrings('fr').steps).toBe('Steps'); // fallback to en
  });
});

describe('recipe submission validation (fail closed)', () => {
  const valid = {
    source: { name: 'Demo', url: 'internal:demo-seed', license: 'internal-demo' },
    originCountry: 'mx',
    locales: [{ country: 'mx', lang: 'es', title: 'Flan', ingredients: ['huevos'], steps: ['mezclar'] }],
  };
  it('accepts a valid submission', () => {
    const r = validateRecipeSubmission(valid);
    expect(r.ok).toBe(true);
  });
  it('rejects malformed JSON shapes', () => {
    expect(validateRecipeSubmission(null).ok).toBe(false);
    expect(validateRecipeSubmission('x').ok).toBe(false);
    expect(validateRecipeSubmission([]).ok).toBe(false);
  });
  it('rejects unknown countries and disabled locales', () => {
    expect(validateRecipeSubmission({ ...valid, locales: [{ ...valid.locales[0], country: 'zz' }] }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...valid, locales: [{ ...valid.locales[0], lang: 'en' }] }).ok).toBe(false);
  });
  it('rejects bad slugs, empty ingredients, non-https source urls', () => {
    expect(validateRecipeSubmission({ ...valid, locales: [{ ...valid.locales[0], slug: 'Bad Slug!' }] }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...valid, locales: [{ ...valid.locales[0], ingredients: [] }] }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...valid, source: { ...valid.source, url: 'http://x.com' } }).ok).toBe(false);
  });
});

describe('parseIngredient', () => {
  it('parses whole numbers', () => {
    expect(parseIngredient('2 eggs')).toEqual({ qty: 2, qtyEnd: null, rest: 'eggs' });
  });
  it('parses decimals and fractions', () => {
    expect(parseIngredient('2.5 cups flour')).toEqual({ qty: 2.5, qtyEnd: null, rest: 'cups flour' });
    expect(parseIngredient('1/2 tsp salt')).toEqual({ qty: 0.5, qtyEnd: null, rest: 'tsp salt' });
    expect(parseIngredient('1 1/2 cups milk')).toEqual({ qty: 1.5, qtyEnd: null, rest: 'cups milk' });
  });
  it('parses unicode fractions and ranges', () => {
    expect(parseIngredient('\u00bd onion')).toEqual({ qty: 0.5, qtyEnd: null, rest: 'onion' });
    expect(parseIngredient('2-3 cloves garlic')).toEqual({ qty: 2, qtyEnd: 3, rest: 'cloves garlic' });
  });
  it('leaves quantity-free lines alone', () => {
    expect(parseIngredient('salt to taste')).toEqual({ qty: null, qtyEnd: null, rest: 'salt to taste' });
  });
});

describe('formatQty', () => {
  it('formats wholes and fractions', () => {
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.5)).toBe('\u00bd');
    expect(formatQty(1.5)).toBe('1 \u00bd');
    expect(formatQty(0.25)).toBe('\u00bc');
  });
});
