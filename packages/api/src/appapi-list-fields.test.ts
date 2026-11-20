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
async function seedPublished(title: string, opts: { category?: string | null } = {}) {
  n += 1;
  const id = `r-${n}`;
  await DB.prepare(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES (?, 'Test Kitchen', 'https://example.com/r', 'CC0-1.0', '2026-01-01T00:00:00Z')`).bind(`src-${id}`).run();
  await DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, category) VALUES (?, ?, 'us', '2026-01-02T00:00:00Z', ?)`).bind(id, `src-${id}`, opts.category ?? null).run();
  await DB.prepare(
    `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, 'us', 'en', ?, ?, NULL, '["1 egg"]', '["Cook."]', 'published')`,
  ).bind(id, title, `slug-${id}`).run();
  return id;
}

async function seedImage(recipeId: string, opts: { style?: string; clearedAt?: string | null; createdAt?: string } = {}) {
  const imageId = `img-${recipeId}-${opts.style ?? 'photo'}`;
  await DB.prepare(
    `INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, 'hero', ?, 'image/webp', 1234, ?, 'fixture', '', 'CC0', ?, ?)`,
  ).bind(
    imageId, recipeId, `k/${imageId}.webp`, opts.style ?? 'photo',
    opts.clearedAt === undefined ? '2026-01-03T00:00:00Z' : opts.clearedAt,
    opts.createdAt ?? '2026-01-03T00:00:00Z',
  ).run();
  return imageId;
}

type ListRow = {
  slug: string;
  title: string;
  lang: string;
  id: string;
  category: string | null;
  heroImage: { url: string; style: string } | null;
};

async function listRows(): Promise<ListRow[]> {
  const res = await app.request('https://2yolks.com/api/v1/countries/us/recipes', {}, env());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { country: string; lang: string; recipes: ListRow[] };
  return body.recipes;
}

beforeEach(() => {
  DB = migratedD1All();
});

describe('GET /api/v1/countries/:code/recipes list fields (native app)', () => {
  it('includes the registered category slug on each row, null when uncategorized', async () => {
    const a = await seedPublished('Mains Soup', { category: 'mains' });
    const b = await seedPublished('Plain Soup');
    const rows = await listRows();
    expect(rows.find((r) => r.id === a)?.category).toBe('mains');
    expect(rows.find((r) => r.id === b)?.category).toBeNull();
  });

  it('includes the latest rights-cleared hero as {url, style} under the canonical origin', async () => {
    const rid = await seedPublished('Photo Soup');
    const img = await seedImage(rid, { style: 'photo' });
    const row = (await listRows()).find((r) => r.id === rid);
    expect(row?.heroImage).toEqual({ url: `https://2yolks.com/img/recipe/${img}`, style: 'photo' });
  });

  it('picks the newest cleared hero per recipe, preserving its honest style', async () => {
    const rid = await seedPublished('Two Heroes Soup');
    await seedImage(rid, { style: 'graphic', createdAt: '2026-01-03T00:00:00Z' });
    const newer = await seedImage(rid, { style: 'illustration', createdAt: '2026-01-04T00:00:00Z' });
    const row = (await listRows()).find((r) => r.id === rid);
    expect(row?.heroImage).toEqual({ url: `https://2yolks.com/img/recipe/${newer}`, style: 'illustration' });
  });

  it('never lists an uncleared or blank-stamped hero: heroImage stays null', async () => {
    const a = await seedPublished('Uncleared Soup');
    await seedImage(a, { clearedAt: null });
    const b = await seedPublished('Blank Stamp Soup');
    await seedImage(b, { clearedAt: '' });
    const rows = await listRows();
    expect(rows.find((r) => r.id === a)?.heroImage).toBeNull();
    expect(rows.find((r) => r.id === b)?.heroImage).toBeNull();
  });

  it('keeps the pre-existing row shape: slug, title, lang, id all still present', async () => {
    const rid = await seedPublished('Shape Soup');
    const row = (await listRows()).find((r) => r.id === rid);
    expect(row).toMatchObject({ slug: `slug-${rid}`, title: 'Shape Soup', lang: 'en', id: rid });
  });
});
