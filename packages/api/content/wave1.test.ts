import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePath, recipePath } from '@2yolks/contracts';

const data = JSON.parse(readFileSync(new URL('./wave1.json', import.meta.url), 'utf8'));

describe('wave 1 editorial drafts', () => {
  it('uses an uncleared internal-original source', () => {
    expect(data.source.license).toBe('internal-original');
  });
  it('has unique ids and (country, lang, slug) keys', () => {
    const ids = new Set(data.recipes.map((r: any) => r.id));
    const keys = new Set(data.recipes.map((r: any) => `${r.country}/${r.lang}/${r.slug}`));
    expect(ids.size).toBe(data.recipes.length);
    expect(keys.size).toBe(data.recipes.length);
  });
  it('keeps locale and language consistent with the wave-1 countries', () => {
    for (const r of data.recipes) {
      expect(['us', 'mx']).toContain(r.country);
      expect(r.lang).toBe(r.country === 'mx' ? 'es' : 'en');
      expect(r.ingredients.length).toBeGreaterThanOrEqual(5);
      expect(r.steps.length).toBeGreaterThanOrEqual(4);
      expect(r.intro).toMatch(/orrador|Draft/);
    }
  });
  it('states a safe cook temperature for every meat recipe', () => {
    for (const r of data.recipes) {
      const text = r.steps.join(' ');
      if (/pork|beef|cerdo|res|pollo/i.test(r.ingredients.join(' '))) {
        expect(text).toMatch(/160°F|71°C|74°C|se deshaga|muy suave/);
      }
    }
  });
  it('has ids and slugs that round-trip through the public URL parser', () => {
    for (const r of data.recipes) {
      expect(r.id).toMatch(/^[a-z0-9]+$/);
      expect(parsePath(recipePath(r.country, r.id, r.slug))).toEqual({ country: r.country, id: r.id, slug: `${r.id}-${r.slug}`, legacySlug: r.slug });
    }
  });
  it('pairs the 145F whole-meat minimum with the 3-minute rest', () => {
    for (const r of data.recipes) {
      const text = r.steps.join(' ');
      if (/145°F/.test(text)) expect(text).toMatch(/3 minutos|3 minutes/);
    }
  });
  it('lists no decimal leading quantities that the display would turn into odd fractions', () => {
    for (const r of data.recipes) for (const i of r.ingredients) expect(i).not.toMatch(/^\d+\.\d/);
  });
});
