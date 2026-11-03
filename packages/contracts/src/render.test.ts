import { describe, it, expect } from 'vitest';
import { renderIngredient, renderStep, defaultUnitSystem, splitUnit } from './index';

describe('unit rendering', () => {
  it('converts metric to US customary within dimension', () => {
    expect(renderIngredient('250 g flour', 'en', 'us')).toBe('9 oz flour');
    expect(renderIngredient('500 ml milk', 'en', 'us')).toBe('2 ⅛ cups milk');
  });
  it('leaves a line alone when already in target system', () => {
    expect(renderIngredient('2 cups flour', 'en', 'us')).toBe('2 cups flour');
  });
  it('converts US to metric', () => {
    expect(renderIngredient('1 lb pork', 'en', 'metric')).toBe('455 g pork');
  });
  it('never converts volume to mass or counts', () => {
    expect(renderIngredient('3 eggs', 'en', 'us')).toBe('3 eggs');
    expect(renderIngredient('2 cloves garlic', 'en', 'metric')).toBe('2 cloves garlic');
  });
  it('does not touch lines with a second number', () => {
    expect(renderIngredient('1 cup (240 ml) milk', 'en', 'metric')).toBe('1 cup (240 ml) milk');
  });
  it('scales', () => {
    expect(renderIngredient('1 cup flour', 'en', 'us', 2)).toBe('2 cups flour');
  });
  it('understands Spanish units and localises labels', () => {
    expect(splitUnit('tazas de harina')?.unit).toBe('cup');
    expect(renderIngredient('2 tazas de harina', 'es', 'metric')).toBe('475 ml de harina');
  });
  it('renders structured ingredients and step tokens', () => {
    const ings = [{ ref: 'oil', qty: 1, unit: 'tbsp', name: 'oil' }];
    expect(renderStep('Heat {i:oil} to {t:350F}.', ings, 'en', 'metric')).toBe('Heat 15 ml to 177\u00b0C.');
    expect(renderStep('Heat {i:oil} to {t:350F}.', ings, 'en', 'us')).toBe('Heat 1 tbsp to 350\u00b0F.');
  });
  it('defaults: us customary only for us', () => {
    expect(defaultUnitSystem('us')).toBe('us');
    expect(defaultUnitSystem('mx')).toBe('metric');
  });
});
