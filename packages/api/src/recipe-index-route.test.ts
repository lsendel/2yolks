// Route tests for the /recipes index page and its sitemap entry.
// Same in-memory D1 harness as slug-urls.test.ts.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';

let SQLITE: DatabaseSync;

function makeD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = () => sqlite.prepare(sql);
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async run() {
        const info = stmt().run(...(bound as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: Number(info.changes),
            changed_db: Number(info.changes) > 0,
            served_by: 'test',
          },
        };
      },
      async all() {
        return { results: stmt().all(...(bound as never[])), success: true, meta: { duration: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: false, served_by: 'test' } };
      },
      async first(col?: string) {
        const row = stmt().get(...(bound as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (col) return row[col] ?? null;
        return row;
      },
      async raw() {
        const rows = stmt().all(...(bound as never[])) as Record<string, unknown>[];
        return rows.map((r) => Object.values(r));
      },
    };
  };
  const d1 = {
    prepare,
    async batch(statements: { run: () => Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec(sql: string) {
      sqlite.exec(sql);
      return Promise.resolve({ count: 0, duration: 0 });
    },
    dump() {
      throw new Error('not implemented');
    },
    withSession() {
      return d1;
    },
  };
  return d1 as unknown as D1Database;
}

function migratedD1(): D1Database {
  SQLITE = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    SQLITE.exec(sql);
  }
  return makeD1(SQLITE);
}

function makeR2() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    objects,
    async put(key: string, value: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
      objects.set(key, { bytes: value, contentType: opts?.httpMetadata?.contentType });
      return { key };
    },
    async get(key: string) {
      const o = objects.get(key);
      if (!o) return null;
      return { body: new Response(o.bytes.slice().buffer as ArrayBuffer).body, httpMetadata: o.contentType };
    },
  };
}

let R2 = makeR2();

// 404s fall through to static assets; stub the binding with a plain 404.
const ASSETS_STUB = { fetch: async () => new Response('no asset', { status: 404 }) };

function env(db: D1Database, extra: Record<string, unknown> = {}) {
  return {
    DB: db,
    IMAGES: R2,
    ASSETS: ASSETS_STUB,
    ADMIN_MCP_API_KEY: 'test-admin-key-0000000000',
    MCP_READ_KEY: 'test-read-key-00000000000',
    MCP_NAMED_KEYS: JSON.stringify([{ name: 'harvester-1', key: 'test-editor-key-000000000', role: 'editor' }]),
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: 'https://2yolks.com',
    ...extra,
  };
}

function seedPublished(id: string, country: string, lang: string, slug: string, title: string) {
  SQLITE.exec(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('src-${id}', 'Test Kitchen', 'https://example.com/r', 'CC0-1.0', datetime('now'))`);
  SQLITE.exec(`INSERT INTO recipes (id, source_id, origin_country) VALUES ('${id}', 'src-${id}', '${country}')`);
  SQLITE.exec(
    `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${id}', '${country}', '${lang}', '${title}', '${slug}', NULL, '["1 egg"]', '["Cook."]', 'published')`,
  );
}

let DB: D1Database;

describe('/recipes index page', () => {
  beforeEach(() => {
    DB = migratedD1();
    R2 = makeR2();
  });

  it('returns 200 (no longer a 404) and lists each published recipe once', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    seedPublished('r2', 'us', 'en', 'test-cookies', 'Test Cookies');
    const res = await app.request('https://2yolks.com/recipes', {}, env(DB));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1>All recipes</h1>');
    expect(html).toContain('/us/recipes/test-pancakes');
    expect(html).toContain('/us/recipes/test-cookies');
  });

  it('serves an empty index (200) when nothing is published', async () => {
    const res = await app.request('https://2yolks.com/recipes', {}, env(DB));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<h1>All recipes</h1>');
  });

  it('honors ?lang=es with the Spanish heading', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    const res = await app.request('https://2yolks.com/recipes?lang=es', {}, env(DB));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1>Todas las recetas</h1>');
    // en-only recipe remains discoverable with a fallback-language badge
    expect(html).toContain('Test Pancakes');
  });

  it('includes /recipes in the sitemap with hreflang alternates', async () => {
    const res = await app.request('https://2yolks.com/sitemap.xml', {}, env(DB));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<loc>https://2yolks.com/recipes</loc>');
    expect(xml).toContain('hreflang="es" href="https://2yolks.com/recipes?lang=es"');
  });

  it('keeps the homepage rendering after the shared loader extraction', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    const res = await app.request('https://2yolks.com/', {}, env(DB));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Test Pancakes');
  });
});
