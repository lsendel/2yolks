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
