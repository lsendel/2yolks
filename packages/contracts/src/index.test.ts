import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  getCountry,
  waveCountries,
  defaultLocale,
  parsePath,
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
  it('builds country/language recipe paths', () => {
    expect(recipePath('mx', 'es', 'huevos-rancheros')).toBe('/mx/es/huevos-rancheros');
  });
  it('parses country-language paths', () => {
    expect(parsePath('/us/en/')).toEqual({ country: 'us', lang: 'en', slug: undefined });
    expect(parsePath('/mx/es/flan')).toEqual({ country: 'mx', lang: 'es', slug: 'flan' });
  });
  it('rejects unregistered countries and locales', () => {
    expect(parsePath('/zz/en/')).toBeNull();
    expect(parsePath('/us/es/')).toBeNull();
  });
  it('slugifies titles with accents and punctuation', () => {
    expect(slugify('Huevos a la Mexicana!')).toBe('huevos-a-la-mexicana');
  });
  it('exposes default locales for wave 1', () => {
    expect(defaultLocale('us')).toBe('en');
    expect(defaultLocale('mx')).toBe('es');
  });
});
