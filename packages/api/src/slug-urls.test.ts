// Tests for clean slug-only recipe URLs, the legacy {id}-{slug} compatibility
// path, and the recipe_slug_aliases frozen map (migration 0005).
// Same in-memory D1 harness as mcp.test.ts.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';

const ADMIN_KEY = 'test-admin-key-0000000000';
const READ_KEY = 'test-read-key-00000000000';
const EDITOR_KEY = 'test-editor-key-000000000';

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
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql']) {
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
      return { body: new Response(o.bytes.slice().buffer as ArrayBuffer).body, httpMetadata: { contentType: o.contentType } };
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
    ADMIN_MCP_API_KEY: ADMIN_KEY,
    MCP_READ_KEY: READ_KEY,
    MCP_NAMED_KEYS: JSON.stringify([{ name: 'harvester-1', key: EDITOR_KEY, role: 'editor' }]),
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: 'https://2yolks.com',
    ...extra,
  };
}

function rpc(method: string, params?: unknown, id = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

function call(token: string | null, method: string, params?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return app.request('https://2yolks.com/api/admin/mcp', { method: 'POST', headers, body: JSON.stringify(rpc(method, params)) }, env(DB));
}

let DB: D1Database;

async function toolCall(token: string, name: string, args: Record<string, unknown>) {
  const res = await call(token, 'tools/call', { name, arguments: args });
  const body = (await res.json()) as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { code: number; message: string } };
  const text = body.result?.content?.[0]?.text;
  return { status: res.status, rpcError: body.error, isError: body.result?.isError === true, data: text ? (JSON.parse(text) as Record<string, unknown>) : undefined };
}

function seedPublished(id: string, country: string, lang: string, slug: string, title: string) {
  SQLITE.exec(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('src-${id}', 'Test Kitchen', 'https://example.com/r', 'CC0-1.0', datetime('now'))`);
  SQLITE.exec(`INSERT INTO recipes (id, source_id, origin_country) VALUES ('${id}', 'src-${id}', '${country}')`);
  SQLITE.exec(
    `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${id}', '${country}', '${lang}', '${title}', '${slug}', NULL, '["1 egg"]', '["Cook."]', 'published')`,
  );
}

const RECIPE = {
  source: { name: 'Test Kitchen', url: 'https://example.com/r', license: 'CC0-1.0' },
  originCountry: 'us',
  locales: [
    {
      country: 'us',
      lang: 'en',
      title: 'Test Pancakes',
      intro: 'Draft: not yet tested in a kitchen.',
      ingredients: ['2 cups flour', '2 eggs', '1 cup milk', '1 tsp salt'],
      steps: ['Mix.', 'Cook 2 minutes per side.', 'Serve.'],
    },
  ],
};

describe('clean and legacy recipe URLs', () => {
  beforeEach(() => {
    DB = migratedD1();
    R2 = makeR2();
  });

  it('serves the clean URL with a self-referencing clean canonical; legacy URL 301s to it', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    const clean = await app.request('https://2yolks.com/us/recipes/test-pancakes', {}, env(DB));
    expect(clean.status).toBe(200);
    const cleanHtml = await clean.text();
    expect(cleanHtml).toContain('Test Pancakes');
    expect(cleanHtml).toContain('rel="canonical" href="https://2yolks.com/us/recipes/test-pancakes"');

    const legacy = await app.request('https://2yolks.com/us/recipes/r1-test-pancakes', {}, env(DB));
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get('location')).toBe('/us/recipes/test-pancakes');
  });

  it('legacy wrong-slug also 301s to the clean canonical URL', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    const res = await app.request('https://2yolks.com/us/recipes/r1-wrong-slug', {}, env(DB));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/us/recipes/test-pancakes');
  });

  it('non-default locale: clean prefixed URL serves, legacy prefixed URL 301s', async () => {
    seedPublished('r1', 'us', 'es', 'panqueques-de-prueba', 'Panqueques de Prueba');
    const clean = await app.request('https://2yolks.com/us/es/recipes/panqueques-de-prueba', {}, env(DB));
    expect(clean.status).toBe(200);
    const legacy = await app.request('https://2yolks.com/us/es/recipes/r1-panqueques-de-prueba', {}, env(DB));
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get('location')).toBe('/us/es/recipes/panqueques-de-prueba');
  });

  it('frozen alias 301s to the current slug; dead alias 404s; live slug wins over alias', async () => {
    seedPublished('r1', 'us', 'en', 'new-slug', 'Test Pancakes');
    SQLITE.exec(`INSERT INTO recipe_slug_aliases (country, lang, slug, recipe_id) VALUES ('us', 'en', 'old-slug', 'r1')`);
    SQLITE.exec(`INSERT INTO recipe_slug_aliases (country, lang, slug, recipe_id) VALUES ('us', 'en', 'new-slug', 'r1')`);
    seedPublished('r2', 'us', 'en', 'gone-slug', 'Gone Recipe');
    SQLITE.exec(`INSERT INTO recipe_slug_aliases (country, lang, slug, recipe_id) VALUES ('us', 'en', 'dead-slug', 'r2')`);
    SQLITE.exec(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = 'r2'`);

    const aliasRes = await app.request('https://2yolks.com/us/recipes/old-slug', {}, env(DB));
    expect(aliasRes.status).toBe(301);
    expect(aliasRes.headers.get('location')).toBe('/us/recipes/new-slug');

    // A live slug always wins over an alias for the same key - no loop.
    const liveRes = await app.request('https://2yolks.com/us/recipes/new-slug', {}, env(DB));
    expect(liveRes.status).toBe(200);

    // Alias whose recipe has no published locale in this country+lang: 404.
    expect((await app.request('https://2yolks.com/us/recipes/dead-slug', {}, env(DB))).status).toBe(404);
  });

  it('404s for unknown slugs and unknown legacy ids', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    expect((await app.request('https://2yolks.com/us/recipes/no-such-recipe', {}, env(DB))).status).toBe(404);
    expect((await app.request('https://2yolks.com/us/recipes/zz999999-test-pancakes', {}, env(DB))).status).toBe(404);
  });

  it('sitemap lists clean URLs with clean hreflang alternates', async () => {
    seedPublished('r1', 'us', 'en', 'test-pancakes', 'Test Pancakes');
    const res = await app.request('https://2yolks.com/sitemap.xml', {}, env(DB));
    const xml = await res.text();
    expect(xml).toContain('<loc>https://2yolks.com/us/recipes/test-pancakes</loc>');
    expect(xml).not.toContain('r1-test-pancakes');
  });
});

describe('recipe_slug_aliases frozen map', () => {
  beforeEach(() => {
    DB = migratedD1();
    R2 = makeR2();
  });

  it('create_draft rejects a slug reserved by another recipe', async () => {
    seedPublished('other', 'us', 'en', 'other-recipe', 'Other Recipe');
    SQLITE.exec(`INSERT INTO recipe_slug_aliases (country, lang, slug, recipe_id) VALUES ('us', 'en', 'taken-slug', 'other')`);
    const res = await toolCall(ADMIN_KEY, 'recipes.create_draft', {
      ...RECIPE,
      locales: [{ ...RECIPE.locales[0], slug: 'taken-slug' }],
      confirmed: true,
    });
    expect(res.status).toBe(200); // tool errors ride in the JSON-RPC body
    expect(res.isError).toBe(true);
    expect((res.data as { error: string }).error).toMatch(/reserved by an earlier public URL/);
  });

  it('unpublish freezes the slug and blocks re-claim by another recipe', async () => {
    const created = await toolCall(ADMIN_KEY, 'recipes.create_draft', {
      ...RECIPE,
      locales: [{ ...RECIPE.locales[0], slug: 'froz-test' }],
      confirmed: true,
    });
    const id = (created.data as { id: string }).id;
    await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: `src-${id}`, confirmed: true, notes: 'CC0 verified' });
    const pub = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(pub.isError).toBe(false);
    const unpub = await toolCall(ADMIN_KEY, 'recipes.unpublish', { id, confirmed: true });
    expect(unpub.isError).toBe(false);
    const rows = SQLITE.prepare(`SELECT country, lang, slug, recipe_id FROM recipe_slug_aliases`).all() as Record<string, unknown>[];
    expect(rows).toEqual([{ country: 'us', lang: 'en', slug: 'froz-test', recipe_id: id }]);
    // Another recipe can never claim the frozen slug.
    const blocked = await toolCall(ADMIN_KEY, 'recipes.create_draft', {
      ...RECIPE,
      locales: [{ ...RECIPE.locales[0], slug: 'froz-test' }],
      confirmed: true,
    });
    expect(blocked.isError).toBe(true);
    expect((blocked.data as { error: string }).error).toMatch(/reserved by an earlier public URL/);
    // add_locale on a different recipe also cannot claim the frozen slug in
    // the same (country, lang) URL space. Recipe 2 is created with an mx
    // original so that a us/en add_locale is a fresh locale on that recipe.
    const created2 = await toolCall(ADMIN_KEY, 'recipes.create_draft', {
      ...RECIPE,
      originCountry: 'mx',
      locales: [
        {
          country: 'mx',
          lang: 'es',
          title: 'Panqueques de Prueba',
          slug: 'panqueques-de-prueba',
          ingredients: ['2 tazas de harina', '2 huevos', '1 taza de leche', '1 pizca de sal'],
          steps: ['Mezclar.', 'Cocinar 2 minutos por lado.', 'Servir.'],
        },
      ],
      confirmed: true,
    });
    const id2 = (created2.data as { id: string }).id;
    const blockedAdd = await toolCall(ADMIN_KEY, 'recipes.add_locale', {
      id: id2,
      confirmed: true,
      locale: {
        country: 'us',
        lang: 'en',
        title: 'Test Pancakes Two',
        slug: 'froz-test',
        ingredients: ['2 cups flour', '2 eggs', '1 cup milk', '1 tsp salt'],
        steps: ['Mix.', 'Cook 2 minutes per side.', 'Serve.'],
        translationOf: 'mx/es',
        translationMethod: 'human',
      },
    });
    expect(blockedAdd.isError).toBe(true);
    expect((blockedAdd.data as { error: string }).error).toMatch(/reserved by an earlier public URL/);
    // The owning recipe is not blocked by its own frozen slug: it can
    // republish, and the alias stays reserved for it.
    const repub = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(repub.isError).toBe(false);
  });
});
