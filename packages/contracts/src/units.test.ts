import { describe, it, expect } from 'vitest';
import { convertQuantity, renderTemps, fahrenheitToCelsius, celsiusToFahrenheit, checkTranslation, checkAllergens, unknownRefs, unitInfo } from './units';

describe('units', () => {
  it('converts mass and volume within dimension', () => {
    expect(convertQuantity({ qty: 450, unit: 'g' }, 'us')).toEqual({ qty: 1, unit: 'lb' });
    expect(convertQuantity({ qty: 1, unit: 'lb' }, 'metric')).toEqual({ qty: 455, unit: 'g' });
    expect(convertQuantity({ qty: 1, unit: 'cup' }, 'metric')).toEqual({ qty: 235, unit: 'ml' });
    expect(convertQuantity({ qty: 1000, unit: 'ml' }, 'us')).toEqual({ qty: 4.25, unit: 'cup' });
    expect(convertQuantity({ qty: 15, unit: 'ml' }, 'us')).toEqual({ qty: 1, unit: 'tbsp' });
  });
  it('never crosses volume and mass, and ignores same-system and unknown units', () => {
    expect(unitInfo('cup')!.dim).toBe('volume');
    expect(convertQuantity({ qty: 2, unit: 'g' }, 'metric')).toBeNull();
    expect(convertQuantity({ qty: 2, unit: 'clove' }, 'us')).toBeNull();
  });
  it('converts temperatures', () => {
    expect(fahrenheitToCelsius(160)).toBe(72);
    expect(fahrenheitToCelsius(145)).toBe(63);
    expect(celsiusToFahrenheit(71)).toBe(160);
    expect(renderTemps('Cook to {t:160F}.', 'metric')).toBe('Cook to 72\u00b0C.');
    expect(renderTemps('Cook to {t:160F}.', 'us')).toBe('Cook to 160\u00b0F.');
    expect(renderTemps('Hornea a {t:180C}.', 'us')).toBe('Hornea a 356\u00b0F.');
  });
  it('flags dangling ingredient refs', () => {
    expect(unknownRefs('Add {i:oil} and {i:salt}', [{ ref: 'oil', qty: 1, unit: 'tbsp', name: 'oil' }])).toEqual(['salt']);
  });
  it('translation gate catches changed numbers and tokens', () => {
    const src = { steps: ['Simmer 15 minutes. Add {i:oil}. Cook to {t:160F}.'] };
    expect(checkTranslation(src, { steps: ['Cocine 15 minutos. Agregue {i:oil}. Cocine a {t:160F}.'] }).ok).toBe(true);
    expect(checkTranslation(src, { steps: ['Cocine 20 minutos. Agregue {i:oil}. Cocine a {t:160F}.'] }).ok).toBe(false);
    expect(checkTranslation(src, { steps: ['Cocine 15 minutos. Agregue aceite. Cocine a 71 C.'] }).ok).toBe(false);
    expect(checkTranslation(src, { steps: ['uno', 'dos'] }).ok).toBe(false);
  });
  it('allergen terms must survive translation', () => {
    expect(checkAllergens('2 eggs, 1 tbsp soy sauce', '2 huevos, 1 cucharada de salsa de soya').ok).toBe(true);
    expect(checkAllergens('2 eggs, 1 tbsp soy sauce', '2 huevos, 1 cucharada de salsa').ok).toBe(false);
  });
});

import { isUntested } from './index';
describe('quality state', () => {
  it('is untested unless a tested date is recorded', () => {
    expect(isUntested({})).toBe(true);
    expect(isUntested({ testedAt: null })).toBe(true);
    expect(isUntested({ testedAt: '2026-11-20' })).toBe(false);
  });
});

import { validateRecipeSubmission, checkStructuredTranslation } from './index';
describe('translation rules in submissions', () => {
  const src = { country: 'us', lang: 'en', title: 'Soup', ingredients: [{ ref: 'oil', qty: 1, unit: 'tbsp', name: 'olive oil' }, '1 onion'], steps: ['Heat {i:oil} for 5 minutes. Cook to {t:160F}.'] };
  const es = { country: 'mx', lang: 'es', title: 'Sopa', translationOf: 'us/en', translationMethod: 'machine' as const, ingredients: [{ ref: 'oil', qty: 1, unit: 'tbsp', name: 'aceite de oliva' }, '1 cebolla'], steps: ['Calienta {i:oil} por 5 minutos. Cocina a {t:160F}.'] };
  const base = { source: { name: 'x', url: 'https://example.com', license: 'internal-original' }, originCountry: 'us' };
  it('accepts a valid original plus translation', () => {
    expect(validateRecipeSubmission({ ...base, locales: [src, es] }).ok).toBe(true);
  });
  it('rejects two originals, missing method, and changed quantities', () => {
    expect(validateRecipeSubmission({ ...base, locales: [src, { ...es, translationOf: undefined }] }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...base, locales: [src, { ...es, translationMethod: undefined }] }).ok).toBe(false);
    const bad = { ...es, ingredients: [{ ref: 'oil', qty: 2, unit: 'tbsp', name: 'aceite' }, '1 cebolla'] };
    expect(validateRecipeSubmission({ ...base, locales: [src, bad] }).ok).toBe(false);
  });
  it('rejects a single locale claiming to be a translation, and unknown sources', () => {
    expect(validateRecipeSubmission({ ...base, locales: [{ ...src, translationOf: 'us/en' }] }).ok).toBe(false);
    expect(validateRecipeSubmission({ ...base, locales: [src, { ...es, translationOf: 'fr/fr' }] }).ok).toBe(false);
  });
  it('structured check flags unit changes', () => {
    expect(checkStructuredTranslation(src.ingredients, [{ ref: 'oil', qty: 1, unit: 'cup', name: 'aceite' }, '1 cebolla']).ok).toBe(false);
  });
});

import { fahrenheitToCelsius as _f2c, celsiusToFahrenheit as _c2f } from './units';
describe('temperature conversion never rounds below the exact value', () => {
  it('safety thresholds', () => {
    expect(_f2c(160)).toBe(72); // exact 71.1
    expect(_f2c(165)).toBe(74); // exact 73.9
    expect(_c2f(74)).toBe(166); // exact 165.2
    expect(_f2c(350)).toBe(177);
  });
});
