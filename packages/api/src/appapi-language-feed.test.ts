import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';
import { migratedD1All } from './testd1';

let DB: D1Database;

function env(extra: Record<string, unknown> = {}) {
  return {
    DB,
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: 'https://2yolks.com',
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    ...extra,
  };
}

let n = 0;
async function seedRecipe(opts: { country?: string; lang?: string; category?: string | null; title?: string } = {}) {
  n += 1;
  const id = `r-${n}`;
  await DB.prepare(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES (?, 'Test Kitchen', 'https://example.com/r', 'CC0-1.0', '2026-01-01T00:00:00Z')`).bind(`src-${id}`).run();
  await DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, category) VALUES (?, ?, 'us', '2026-01-02T00:00:00Z', ?)`).bind(id, `src-${id}`, opts.category ?? null).run();
  await seedLocale(id, opts);
  return id;
}

async function seedLocale(recipeId: string, opts: { country?: string; lang?: string; title?: string } = {}) {
  const country = opts.country ?? 'us';
  const lang = opts.lang ?? 'en';
  const title = opts.title ?? `Recipe ${recipeId} ${lang}`;
  await DB.prepare(
    `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, ?, ?, ?, ?, NULL, '["1 egg"]', '["Cook."]', 'published')`,
  ).bind(recipeId, country, lang, title, `slug-${recipeId}-${lang}`).run();
}

async function seedHero(recipeId: string) {
  const imageId = `img-${recipeId}`;
  await DB.prepare(
    `INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, 'hero', ?, 'image/webp', 1234, 'photo', 'fixture', '', 'CC0', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z')`,
  ).bind(imageId, recipeId, `k/${imageId}.webp`).run();
  return imageId;
}

beforeEach(() => {
  DB = migratedD1All();
});

describe('GET /api/v1/countries detectedCountry', () => {
  const countries = async (headers: Record<string, string> = {}) => {
    const res = await app.request('https://2yolks.com/api/v1/countries', { headers }, env());
    expect(res.status).toBe(200);
    return (await res.json()) as { detectedCountry: string | null };
  };

  it('reads the cf-ipcountry header, lowercased and registry-checked', async () => {
    expect((await countries({ 'cf-ipcountry': 'MX' })).detectedCountry).toBe('mx');
  });
  it('is null when the header is absent or not a known country', async () => {
    expect((await countries()).detectedCountry).toBeNull();
    expect((await countries({ 'cf-ipcountry': 'XX' })).detectedCountry).toBeNull();
  });
});

describe('GET /api/v1/recipes language feed', () => {
  type FeedRow = { id: string; country: string; lang: string; slug: string; title: string; category: string | null; heroImage: { url: string; style: string } | null };
  const feed = async (lang = 'en') => {
    const res = await app.request(`https://2yolks.com/api/v1/recipes?lang=${lang}`, {}, env());
    return { status: res.status, body: (await res.json()) as { lang: string; languages: string[]; recipes: FeedRow[] } };
  };

  it('lists each published recipe once, preferring the requested language', async () => {
    const a = await seedRecipe({ title: 'Cookies EN' });
    await seedLocale(a, { country: 'mx', lang: 'es', title: 'Galletas ES' });
    const b = await seedRecipe({ title: 'Only English' });
    const { body } = await feed('es');
    expect(body.lang).toBe('es');
    const rowA = body.recipes.find((r) => r.id === a);
    const rowB = body.recipes.find((r) => r.id === b);
    expect(rowA?.title).toBe('Galletas ES');
    expect(rowA?.lang).toBe('es');
    // No requested-language locale: the fallback row stays listed with its
    // actual language so the client can badge it honestly.
    expect(rowB?.title).toBe('Only English');
    expect(rowB?.lang).toBe('en');
    expect(body.recipes.filter((r) => r.id === a)).toHaveLength(1);
  });

  it('carries category and the rights-cleared hero image per row', async () => {
    const a = await seedRecipe({ category: 'mains' });
    const img = await seedHero(a);
    const { body } = await feed('en');
    const row = body.recipes.find((r) => r.id === a);
    expect(row?.category).toBe('mains');
    expect(row?.heroImage).toEqual({ url: `https://2yolks.com/img/recipe/${img}`, style: 'photo' });
  });

  it('rejects an unsupported language with the supported list', async () => {
    const { status, body } = await feed('de');
    expect(status).toBe(404);
    expect((body as unknown as { languages: string[] }).languages).toEqual(['en', 'es', 'fr']);
  });
});
