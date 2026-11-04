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
async function seedPublished(title: string) {
  n += 1;
  const id = `r-${n}`;
  await DB.prepare(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES (?, 'Test Kitchen', 'https://example.com/r', 'CC0-1.0', '2026-01-01T00:00:00Z')`).bind(`src-${id}`).run();
  await DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at) VALUES (?, ?, 'us', '2026-01-02T00:00:00Z')`).bind(id, `src-${id}`).run();
  await DB.prepare(
    `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, 'us', 'en', ?, ?, NULL, '["1 egg"]', '["Cook."]', 'published')`,
  ).bind(id, title, `slug-${id}`).run();
  return id;
}

async function seedImage(recipeId: string, opts: { style?: string | null; clearedAt?: string | null } = {}) {
  const imageId = `img-${recipeId}`;
  await DB.prepare(
    `INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, 'hero', ?, 'image/webp', 1234, ?, 'fixture', '', 'CC0', ?, '2026-01-03T00:00:00Z')`,
  ).bind(imageId, recipeId, `k/${imageId}.webp`, opts.style === undefined ? 'photo' : opts.style, opts.clearedAt === undefined ? '2026-01-03T00:00:00Z' : opts.clearedAt).run();
  return imageId;
}

const home = async () => (await app.request('https://2yolks.com/', {}, env())).text();
const usHome = async () => (await app.request('https://2yolks.com/us', {}, env())).text();

beforeEach(() => {
  DB = migratedD1All();
});

describe('list hero images (SSR routes)', () => {
  it('shows a cleared photo hero with its honest label on the home list', async () => {
    const rid = await seedPublished('Cleared Soup');
    const img = await seedImage(rid, { style: 'photo' });
    const body = await home();
    expect(body).toContain(`/img/recipe/${img}`);
    expect(body).toContain('>Photo</span>');
  });
  it('rejects unknown and NULL styles at the schema boundary (CHECK constraint)', async () => {
    const rid = await seedPublished('Checked Soup');
    await expect(seedImage(rid, { style: 'oil-painting' })).rejects.toThrow();
    await expect(seedImage(rid, { style: null })).rejects.toThrow();
    // Fail-closed rendering of an unknown style value (defense in depth past
    // the CHECK) is covered in packages/web/src/discovery-images.test.ts.
  });
  it('treats a blank cleared_at stamp as uncleared, matching the image endpoint', async () => {
    const rid = await seedPublished('Blank Stamp Soup');
    const img = await seedImage(rid, { clearedAt: '' });
    expect(await home()).not.toContain(`/img/recipe/${img}`);
    expect(await usHome()).not.toContain(`/img/recipe/${img}`);
  });
  it('never lists an uncleared hero', async () => {
    const rid = await seedPublished('Uncleared Soup');
    const img = await seedImage(rid, { clearedAt: null });
    expect(await home()).not.toContain(`/img/recipe/${img}`);
  });
  it('picks the latest cleared hero per recipe', async () => {
    const rid = await seedPublished('Two Heroes Soup');
    const older = await seedImage(rid, { style: 'graphic' });
    const newer = `img-${rid}-new`;
    await DB.prepare(
      `INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, 'hero', ?, 'image/webp', 1234, 'illustration', 'fixture', '', 'CC0', '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z')`,
    ).bind(newer, rid, `k/${newer}.webp`).run();
    const body = await home();
    expect(body).toContain(`/img/recipe/${newer}`);
    expect(body).not.toContain(`/img/recipe/${older}\"`);
    expect(body).toContain('AI illustration');
  });
});
