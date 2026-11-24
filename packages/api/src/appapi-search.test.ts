import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';
import { migratedD1All } from './testd1';
let DB: D1Database;
const env = () => ({ DB, ALLOW_DEMO_SEED: 'false', CANONICAL_ORIGIN: 'https://2yolks.com', ASSETS: { fetch: async () => new Response('', { status: 404 }) } });
beforeEach(async () => {
  DB = migratedD1All();
  await DB.prepare(`INSERT INTO sources (id,name,url,license,cleared_at) VALUES ('s','Kitchen','https://example.com','CC0','2026-01-01')`).run();
  await DB.prepare(`INSERT INTO recipes (id,source_id,origin_country,created_at,category,total_minutes) VALUES ('r','s','us','2026-01-01','mains',20)`).run();
  await DB.prepare(`INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,ingredients_json,steps_json,status) VALUES ('r','us','en','Golden supper','golden-supper','["chicken and rice"]','["Cook"]','published')`).run();
  await DB.prepare(`INSERT INTO recipe_images (id,recipe_id,kind,r2_key,mime,bytes,style,source_name,source_url,license,cleared_at,created_at) VALUES ('i','r','hero','i.webp','image/webp',100,'photo','Kitchen','','CC0','2026-01-01','2026-01-01')`).run();
});
async function search(query: string) {
  const res = await app.request(`https://2yolks.com/api/v1/search?${query}`, {}, env());
  return { res, body: await res.json() as any };
}
describe('native JSON search contract', () => {
  it('searches ingredients through the web engine, with honest images and language', async () => {
    const { res, body } = await search('q=chicken&lang=es');
    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.recipes[0]).toMatchObject({ id: 'r', lang: 'en', title: 'Golden supper', category: 'mains', heroImage: { url: 'https://2yolks.com/img/recipe/i', style: 'photo' } });
    expect(body.lang).toBe('es');
  });
  it('shares category/time filters with web, not a title-only local filter', async () => {
    expect((await search('q=chicken&cat=drinks')).body.total).toBe(0);
    expect((await search('q=chicken&cat=mains')).body.total).toBe(1);
    expect((await search('cat=mains&page=999')).body.page).toBe(200);
  });
  it('rejects unsupported language and never logs read-only search gaps', async () => {
    expect((await search('lang=de')).res.status).toBe(404);
    await search('q=missingdish');
    const count = await DB.prepare('SELECT count(*) as n FROM search_gap_logs').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
