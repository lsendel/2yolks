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
  scalingIsSafe,
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
    // Legacy {id}-{slug} shape: full segment is the slug reading, and the
    // legacy id/slug split is carried alongside for the fallback lookup.
    expect(parsePath('/mx/recipes/r1-huevos-rancheros')).toEqual({
      country: 'mx',
      id: 'r1',
      slug: 'r1-huevos-rancheros',
      legacySlug: 'huevos-rancheros',
    });
  });
  it('parses clean slug-only recipe paths without inventing an id', () => {
    expect(parsePath('/us/recipes/pancakes')).toEqual({ country: 'us', slug: 'pancakes' });
    expect(parsePath('/us/recipes/sweet-potato-casserole')).toEqual({
      country: 'us',
      id: 'sweet',
      slug: 'sweet-potato-casserole',
      legacySlug: 'potato-casserole',
    });
    expect(parsePath('/us/es/recipes/pancakes')).toEqual({ country: 'us', lang: 'es', slug: 'pancakes' });
    // Default locale must not use the lang-prefixed shape.
    expect(parsePath('/us/en/recipes/pancakes')).toBeNull();
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
    expect(uiStrings('fr').steps).toBe('\u00c9tapes');
    expect(uiStrings('de').steps).toBe('Steps'); // unsupported falls back to en
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
    expect(validateRecipeSubmission({ ...valid, locales: [{ ...valid.locales[0], lang: 'de' }] }).ok).toBe(false);
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

describe('scalingIsSafe', () => {
  it('allows simple lists whose steps quote no amounts', () => {
    expect(scalingIsSafe(['2 huevos', '2 tortillas', 'salsa'], ['Warm tortillas', 'Fry eggs 3 minutes'])).toBe(true);
  });
  it('blocks scaling when ingredients carry unit conversions', () => {
    expect(scalingIsSafe(['2 cups (500 ml) water'], ['Boil'])).toBe(false);
  });
  it('blocks scaling when steps quote ingredient amounts', () => {
    expect(scalingIsSafe(['1 cup rice'], ['Add 1/2 cup water'])).toBe(false);
    expect(scalingIsSafe(['1 taza arroz'], ['Agrega 250 ml de agua'])).toBe(false);
  });
});

import { recipePathFor as _rpf, parsePath as _pp, LOCALES as _LOC } from './index';
describe('locale-aware recipe paths', () => {
  it('default locale keeps the legacy URL', () => {
    expect(_rpf('mx', 'es', 'abc123', 'pozole')).toBe('/mx/recipes/abc123-pozole');
    expect(_rpf('us', 'en', 'abc123', 'soup')).toBe('/us/recipes/abc123-soup');
    expect(_pp('/mx/recipes/abc123-pozole')).toEqual({ country: 'mx', id: 'abc123', slug: 'abc123-pozole', legacySlug: 'pozole' });
  });
  it('non-default locale gets a prefix only when registered; unregistered/default prefixes do not parse', () => {
    expect(_rpf('mx', 'en', 'abc123', 'pozole')).toBe('/mx/en/recipes/abc123-pozole');
    expect(_pp('/mx/en/recipes/abc123-pozole')).toEqual({ country: 'mx', lang: 'en', id: 'abc123', slug: 'abc123-pozole', legacySlug: 'pozole' });
    expect(_pp('/mx/fr/recipes/abc123-pozole')).toEqual({ country: 'mx', lang: 'fr', id: 'abc123', slug: 'abc123-pozole', legacySlug: 'pozole' });
    expect(_pp('/mx/de/recipes/abc123-pozole')).toBeNull(); // unregistered
    expect(_pp('/mx/es/recipes/abc123-pozole')).toBeNull(); // default locale: no duplicate URL
    expect(_LOC.us).toEqual(['en', 'es', 'fr']);
    expect(_LOC.mx).toEqual(['es', 'en', 'fr']);
  });
});

describe('parseTimeFields / parseCategoryField (migration 0004)', () => {
  it('validates minutes, servings and category slugs', async () => {
    const { parseTimeFields, parseCategoryField } = await import('./index');
    const ok = parseTimeFields({ prepMinutes: 10, cookMinutes: 20, totalMinutes: 30, baseServings: 4 });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.values).toEqual({ prepMinutes: 10, cookMinutes: 20, totalMinutes: 30, baseServings: 4 });
      expect(ok.warnings).toEqual([]);
    }
    const snake = parseTimeFields({ prep_minutes: 5 });
    expect(snake.ok && snake.values.prepMinutes).toBe(5);
    const clear = parseTimeFields({ prepMinutes: null });
    expect(clear.ok && clear.values.prepMinutes).toBeNull();
    expect(parseTimeFields({ prepMinutes: -1 }).ok).toBe(false);
    expect(parseTimeFields({ prepMinutes: 1.5 }).ok).toBe(false);
    expect(parseTimeFields({ totalMinutes: 0 }).ok).toBe(false);
    expect(parseTimeFields({ baseServings: 0 }).ok).toBe(false);
    const overlap = parseTimeFields({ prepMinutes: 30, cookMinutes: 40, totalMinutes: 50 });
    expect(overlap.ok && overlap.warnings.length).toBe(1);

    const absent = parseCategoryField({});
    expect(absent.ok).toBe(true);
    if (absent.ok) expect(absent.present).toBe(false);
    const cat = parseCategoryField({ category: 'tacos-tortillas' });
    expect(cat.ok && cat.present && cat.value).toBe('tacos-tortillas');
    expect(parseCategoryField({ category: null })).toEqual({ ok: true, present: true, value: null });
    expect(parseCategoryField({ category: 'healthy' }).ok).toBe(false);
  });

  it('validateRecipeSubmission fails closed on bad times and categories', () => {
    const base = {
      source: { name: 'T', url: 'https://example.com', license: 'CC0-1.0' },
      locales: [{ country: 'us', lang: 'en', title: 'X', ingredients: ['1 egg'], steps: ['Cook.'] }],
    };
    expect(validateRecipeSubmission({ ...base, prepMinutes: 10, category: 'soups-stews' }).ok).toBe(true);
    expect(validateRecipeSubmission({ ...base, prepMinutes: -3 }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...base, category: 'keto' }).ok).toBe(false);
  });
});
