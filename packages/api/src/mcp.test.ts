// Tests for the 2yolks admin MCP (packages/api/src/mcp.ts).
// Runs the real Hono app against an in-memory D1 backed by node:sqlite,
// with the 0001 + 0002 migrations applied.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { COUNTRIES, LOCALES } from '@2yolks/contracts';
import app from './index';

const ADMIN_KEY = 'test-admin-key-0000000000';
const READ_KEY = 'test-read-key-00000000000';
const EDITOR_KEY = 'test-editor-key-000000000';

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
        return {
          results: stmt().all(...(bound as never[])),
          success: true,
          meta: { duration: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: false, served_by: 'test' },
        };
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
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql']) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    sqlite.exec(sql);
  }
  return makeD1(sqlite);
}

function env(db: D1Database, extra: Record<string, string> = {}) {
  return {
    DB: db,
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
  return app.request(
    'https://2yolks.com/api/admin/mcp',
    { method: 'POST', headers, body: JSON.stringify(rpc(method, params)) },
    env(DB),
  );
}

// Per-test database, swapped via closure.
let DB: D1Database;

async function toolCall(token: string, name: string, args: Record<string, unknown>) {
  const res = await call(token, 'tools/call', { name, arguments: args });
  const body = (await res.json()) as {
    result?: { content?: { text: string }[]; isError?: boolean };
    error?: { code: number; message: string };
  };
  const text = body.result?.content?.[0]?.text;
  return {
    status: res.status,
    rpcError: body.error,
    isError: body.result?.isError === true,
    data: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
  };
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

describe('admin MCP', () => {
  beforeEach(() => {
    DB = migratedD1();
  });

  it('fails closed with 503 when no keys are configured', async () => {
    const res = await app.request(
      'https://2yolks.com/api/admin/mcp',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rpc('ping')) },
      { DB, ALLOW_DEMO_SEED: 'false' },
    );
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('MCP_NOT_CONFIGURED');
  });

  it('rejects missing and invalid tokens with 401', async () => {
    expect((await call(null, 'ping')).status).toBe(401);
    expect((await call('wrong-key', 'ping')).status).toBe(401);
  });

  it('scopes tools/list to the caller role', async () => {
    const asViewer = await call(READ_KEY, 'tools/list');
    const viewerTools = (((await asViewer.json()) as { result: { tools: { name: string }[] } }).result.tools).map(
      (t) => t.name,
    );
    expect(viewerTools).toContain('recipes.list');
    expect(viewerTools).not.toContain('recipes.create_draft');
    const asAdmin = await call(ADMIN_KEY, 'tools/list');
    const adminTools = (((await asAdmin.json()) as { result: { tools: { name: string }[] } }).result.tools).map(
      (t) => t.name,
    );
    expect(adminTools).toContain('recipes.publish');
    expect(adminTools).toContain('sources.clear_rights');
  });

  it('GET /tools catalog requires auth and reflects role', async () => {
    const unauth = await app.request('https://2yolks.com/api/admin/mcp/tools', {}, env(DB));
    expect(unauth.status).toBe(401);
    const res = await app.request(
      'https://2yolks.com/api/admin/mcp/tools',
      { headers: { authorization: `Bearer ${READ_KEY}` } },
      env(DB),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: string; tools: { name: string }[] };
    expect(body.role).toBe('viewer');
    expect(body.tools.map((t) => t.name)).not.toContain('blog.publish');
  });

  it('runs the full recipe lifecycle with draft-first and rights gating', async () => {
    // editor creates a draft
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    expect(created.status).toBe(200);
    expect(created.isError).toBe(false);
    const id = created.data?.['id'] as string;
    const sourceId = created.data?.['source_id'] as string;
    expect(id).toMatch(/^[a-z0-9]+$/);

    // viewer cannot create
    const denied = await toolCall(READ_KEY, 'recipes.create_draft', RECIPE);
    expect(denied.isError).toBe(true);
    expect((denied.data as { error: string }).error).toBe('insufficient role');

    // admin cannot publish while the source is uncleared
    const early = await toolCall(ADMIN_KEY, 'recipes.publish', { id });
    expect(early.isError).toBe(true);
    expect((early.data as { error: string }).error).toBe('source rights not cleared');

    // public API does not list the draft
    const pub = await app.request('https://2yolks.com/api/v1/countries/us/recipes', {}, env(DB));
    expect(((await pub.json()) as { recipes: unknown[] }).recipes.length).toBe(0);
    const cat0 = (await (await app.request('https://2yolks.com/api/v1/countries', {}, env(DB))).json()) as { countries: unknown[]; locales: Record<string, string[]>; published: Record<string, string[]> };
    expect(cat0.countries.length).toBe(COUNTRIES.length);
    expect(cat0.locales).toEqual(JSON.parse(JSON.stringify(LOCALES)));
    expect(cat0.published.us).toBeUndefined();

    // clear_rights requires confirmation and a reason
    const unconfirmed = await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: sourceId });
    expect((unconfirmed.data as { error: string }).error).toMatch(/confirmed/);
    const noNotes = await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: sourceId, confirmed: true });
    expect((noNotes.data as { error: string }).error).toMatch(/notes/);
    const cleared = await toolCall(ADMIN_KEY, 'sources.clear_rights', {
      id: sourceId,
      confirmed: true,
      notes: 'CC0 public domain dedication verified on source page',
    });
    expect(cleared.isError).toBe(false);

    // editor can update the draft, then admin publishes it
    const upd = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [{ country: 'us', lang: 'en', intro: 'Kitchen-tested by the 2yolks team.' }],
    });
    expect(upd.isError).toBe(false);
    const pubNow = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(pubNow.isError).toBe(false);

    // public API now lists it
    const pub2 = await app.request('https://2yolks.com/api/v1/countries/us/recipes', {}, env(DB));
    const listed = ((await pub2.json()) as { recipes: { title: string }[] }).recipes;
    expect(listed.map((r) => r.title)).toContain('Test Pancakes');
    const cat1 = (await (await app.request('https://2yolks.com/api/v1/countries', {}, env(DB))).json()) as { published: Record<string, string[]> };
    expect(cat1.published.us).toContain('en');

    // published locales are not editable; unpublish returns to draft
    const editPub = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [{ country: 'us', lang: 'en', title: 'Nope' }],
    });
    expect(editPub.isError).toBe(true);
    expect((editPub.data as { error: string }).error).toBe('only draft locales are editable');
    const unpub = await toolCall(ADMIN_KEY, 'recipes.unpublish', { id, country: 'us', lang: 'en', confirmed: true });
    expect(unpub.isError).toBe(false);
    const pub3 = await app.request('https://2yolks.com/api/v1/countries/us/recipes', {}, env(DB));
    expect(((await pub3.json()) as { recipes: unknown[] }).recipes.length).toBe(0);

    // audit trail captured the writes
    const audits = await DB.prepare("SELECT COUNT(*) AS n FROM mcp_audit WHERE tool LIKE 'recipes.%' OR tool LIKE 'sources.%'")
      .bind()
      .first<{ n: number }>();
    expect(Number(audits?.n)).toBeGreaterThanOrEqual(4);
  });

  it('validates recipe submissions the same way as public submissions', async () => {
    const bad = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      source: { name: 'X', url: 'http://insecure.example', license: 'CC0-1.0' },
      locales: RECIPE.locales,
    });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(bad.data)).toMatch(/https/);
  });

  it('runs the blog lifecycle draft -> publish -> unpublish', async () => {
    const created = await toolCall(EDITOR_KEY, 'blog.create_draft', {
      author: 'harvester-1',
      confirmed: true,
      locales: [
        { country: 'us', lang: 'en', title: 'Why Two Yolks', body: '# Hello\n\nFirst post.', excerpt: 'Intro' },
        { country: 'mx', lang: 'es', title: 'Por Que Dos Yemas', body: '# Hola\n\nPrimer post.' },
      ],
    });
    expect(created.isError).toBe(false);
    const id = created.data?.['id'] as string;

    // drafts are listed with status filter
    const drafts = await toolCall(READ_KEY, 'blog.list', { status: 'draft' });
    expect((drafts.data?.['posts'] as unknown[]).length).toBe(2);

    const pub = await toolCall(ADMIN_KEY, 'blog.publish', { id, country: 'us', lang: 'en', confirmed: true, review: 'Vetted by Luis, original text' });
    expect(pub.isError).toBe(false);
    expect(pub.data?.['locales_changed']).toBe(1);

    const listed = await toolCall(READ_KEY, 'blog.list', { status: 'published' });
    const posts = listed.data?.['posts'] as { slug: string; country: string }[];
    expect(posts.length).toBe(1);
    expect(posts[0]?.slug).toBe('why-two-yolks');

    const unpub = await toolCall(ADMIN_KEY, 'blog.unpublish', { id, confirmed: true });
    expect(unpub.isError).toBe(false);
    const remaining = await toolCall(READ_KEY, 'blog.list', { status: 'published' });
    expect((remaining.data?.['posts'] as unknown[]).length).toBe(0);
  });

  it('rejects blog locales for unlaunched countries and bad slugs', async () => {
    const badCountry = await toolCall(EDITOR_KEY, 'blog.create_draft', {
      author: 'a',
      locales: [{ country: 'zz', lang: 'en', title: 'T', body: 'B' }],
    });
    expect(badCountry.isError).toBe(true);
    const badSlug = await toolCall(EDITOR_KEY, 'blog.create_draft', {
      author: 'a',
      locales: [{ country: 'us', lang: 'en', title: 'T', body: 'B', slug: 'Has Spaces' }],
    });
    expect(badSlug.isError).toBe(true);
  });
});

describe('MCP hardening', () => {
  beforeEach(() => {
    DB = migratedD1();
  });

  async function shorthand(token: string, payload: Record<string, unknown>) {
    const res = await app.request(
      'https://2yolks.com/api/admin/mcp',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-mcp-caller': 'merlin-cli' },
        body: JSON.stringify(payload),
      },
      env(DB),
    );
    return { status: res.status, data: (await res.json()) as Record<string, unknown> };
  }

  it('supports the directory shorthand shape: unconfirmed writes are dry runs, confirmed writes execute', async () => {
    // exactly what scripts/mcp-cli.mjs sends without --apply: dryRun default
    const dry = await shorthand(EDITOR_KEY, { name: 'recipes.create_draft', dryRun: true, arguments: RECIPE });
    expect(dry.status).toBe(200);
    expect(dry.data['dry_run']).toBe(true);
    const listed = await toolCall(READ_KEY, 'recipes.list', {});
    expect((listed.data?.['recipes'] as unknown[]).length).toBe(0);

    // shorthand without any dryRun flag but without confirmed: also a dry run
    const implicit = await shorthand(EDITOR_KEY, { name: 'recipes.create_draft', arguments: RECIPE });
    expect(implicit.data['dry_run']).toBe(true);

    // confirmed shorthand executes
    const exec = await shorthand(EDITOR_KEY, { name: 'recipes.create_draft', confirmed: true, arguments: RECIPE });
    expect(exec.status).toBe(201);
    expect(typeof exec.data['id']).toBe('string');
  });

  it('ignores injected rights/status fields in submitted content', async () => {
    const malicious = {
      ...RECIPE,
      cleared_at: 'now',
      clearedAt: '2026-01-01',
      status: 'published',
      source: { ...RECIPE.source, cleared_at: '2026-01-01', clearedAt: '2026-01-01' },
    };
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...malicious, confirmed: true });
    expect(created.isError).toBe(false);
    const sourceId = created.data?.['source_id'] as string;
    const row = await DB.prepare('SELECT cleared_at FROM sources WHERE id = ?').bind(sourceId).first<{ cleared_at: string | null }>();
    expect(row?.cleared_at).toBeNull();
    // and publishing stays blocked
    const pub = await toolCall(ADMIN_KEY, 'recipes.publish', { id: created.data?.['id'] });
    expect((pub.data as { error: string }).error).toBe('source rights not cleared');
  });

  it('returns 409 with the existing id on a duplicate locale slug', async () => {
    const first = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    const second = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    expect(second.isError).toBe(true);
    expect((second.data as { error: string }).error).toMatch(/already exists/);
    expect((second.data as { existing_id: string }).existing_id).toBe(first.data?.['id']);
  });

  it('treats an unconfirmed write on the JSON-RPC transport as a dry run, same as shorthand', async () => {
    const dry = await toolCall(EDITOR_KEY, 'recipes.create_draft', RECIPE);
    expect(dry.isError).toBe(false);
    expect(dry.data?.['dry_run']).toBe(true);
    expect(await dbCount('recipes')).toBe(0);
    const exec = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    expect(exec.isError).toBe(false);
    expect(await dbCount('recipes')).toBe(1);
  });

  it('enforces the same role gates on both transports', async () => {
    const viaRpc = await toolCall(READ_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    expect(viaRpc.isError).toBe(true);
    expect(JSON.stringify(viaRpc.data)).toContain('insufficient role');
    const viaShorthand = await shorthand(READ_KEY, { name: 'recipes.create_draft', confirmed: true, arguments: RECIPE });
    expect(viaShorthand.status).toBe(403);
    expect(await dbCount('recipes')).toBe(0);
  });

  it('blog.publish refuses without confirmed + review note, even for admin', async () => {
    const created = await toolCall(EDITOR_KEY, 'blog.create_draft', {
      author: 'harvester-1',
      confirmed: true,
      locales: [{ country: 'us', lang: 'en', title: 'T', body: 'Body text for the blog post.' }],
    });
    const id = created.data?.['id'] as string;
    const noReview = await toolCall(ADMIN_KEY, 'blog.publish', { id, confirmed: true });
    expect(noReview.isError).toBe(true);
    expect(JSON.stringify(noReview.data)).toContain('review');
    const noConfirm = await toolCall(ADMIN_KEY, 'blog.publish', { id, review: 'looks fine' });
    expect(noConfirm.isError).toBe(true);
    expect(JSON.stringify(noConfirm.data)).toContain('confirmed');
    const row = await DB.prepare('SELECT status FROM blog_post_locales WHERE post_id = ?').bind(id).first<{ status: string }>();
    expect(row!.status).toBe('draft');
  });

  it('commits no content when the audit write fails (no blind-retry 500s)', async () => {
    DB.exec('DROP TABLE mcp_audit');
    const res = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    expect(res.isError).toBe(true);
    expect(await dbCount('recipes')).toBe(0);
    expect(await dbCount('sources')).toBe(0);
  });

  it('attributes audit rows to the authenticated key, not the caller header', async () => {
    await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true }); // header-less JSON-RPC
    const res = await app.request(
      'https://2yolks.com/api/admin/mcp',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${EDITOR_KEY}`, 'x-mcp-caller': 'spoofed-name' },
        body: JSON.stringify(rpc('tools/call', { name: 'recipes.create_draft', arguments: { ...RECIPE, locales: [{ ...RECIPE.locales[0], slug: 'second-slug' }] }, confirmed: true })),
      },
      env(DB),
    );
    expect(res.status).toBe(200);
    const rows = await DB.prepare("SELECT actor, details_json FROM mcp_audit WHERE tool = 'recipes.create_draft' ORDER BY id").bind().all();
    const actors = (rows.results as { actor: string; details_json: string }[]);
    expect(actors.length).toBe(2);
    for (const a of actors) expect(a.actor).toBe('harvester-1'); // named key, never the header
    expect(actors[1]?.details_json).toContain('spoofed-name'); // header kept only as declared_caller detail
  });

  it('rejects array bodies, oversized requests and locale floods', async () => {
    const arr = await app.request(
      'https://2yolks.com/api/admin/mcp',
      { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_KEY}` }, body: JSON.stringify([rpc('ping')]) },
      env(DB),
    );
    expect(arr.status).toBe(400);
    const big = await app.request(
      'https://2yolks.com/api/admin/mcp',
      { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_KEY}`, 'content-length': '300000' }, body: JSON.stringify(rpc('ping')) },
      env(DB),
    );
    expect(big.status).toBe(413);
    const flood = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      ...RECIPE,
      locales: Array.from({ length: 13 }, (_, i) => ({ ...RECIPE.locales[0], slug: `slug-${i}` })),
    });
    expect(flood.isError).toBe(true);
    expect(JSON.stringify(flood.data)).toMatch(/at most 12/);
  });

  it('fails closed when a stored locale is no longer plain string arrays', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    const id = created.data?.['id'] as string;
    await DB.prepare("UPDATE recipe_locales SET ingredients_json = ? WHERE recipe_id = ?")
      .bind(JSON.stringify([{ qty: 2, unit: 'cups', item: 'flour' }]), id)
      .run();
    const upd = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [{ country: 'us', lang: 'en', ingredients: ['3 cups flour'] }],
    });
    expect(upd.isError).toBe(true);
    expect((upd.data as { error: string }).error).toBe('stored locale shape is not editable by this tool version');
  });

  it('dry-run via JSON-RPC validates without writing', async () => {
    const dry = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, dryRun: true });
    expect(dry.isError).toBe(false);
    expect(dry.data?.['dry_run']).toBe(true);
    const listed = await toolCall(READ_KEY, 'recipes.list', {});
    expect((listed.data?.['recipes'] as unknown[]).length).toBe(0);
  });
});

const STRUCTURED_RECIPE = {
  source: { name: 'Test Kitchen', url: 'https://example.com/r', license: 'CC0-1.0' },
  originCountry: 'us',
  locales: [
    {
      country: 'us',
      lang: 'en',
      title: 'Structured Pancakes',
      ingredients: [
        { ref: 'flour', qty: 2, unit: 'cup', name: 'flour' },
        { ref: 'eggs', qty: 2, name: 'eggs' },
        { ref: 'milk', qty: 1, unit: 'cup', name: 'milk' },
      ],
      steps: ['Whisk {i:eggs} into {i:flour}.', 'Add {i:milk}.', 'Cook at {t:350F} for 20 minutes.'],
    },
  ],
};

const TRANSLATED_RECIPE = {
  source: { name: 'Test Kitchen', url: 'https://example.com/r', license: 'CC0-1.0' },
  originCountry: 'us',
  locales: [
    {
      country: 'us',
      lang: 'en',
      title: 'Test Pancakes',
      ingredients: ['2 cups flour', '2 eggs', '1 cup milk', '1 tsp salt'],
      steps: ['Mix.', 'Cook 2 minutes per side.', 'Serve.'],
    },
    {
      country: 'mx',
      lang: 'es',
      title: 'Panqueques de prueba',
      translationOf: 'us/en',
      translationMethod: 'machine',
      ingredients: ['2 tazas de harina', '2 huevos', '1 taza de leche', '1 pizca de sal'],
      steps: ['Mezclar.', 'Cocinar 2 minutos por lado.', 'Servir.'],
    },
  ],
};

async function dbCount(table: string): Promise<number> {
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return r!.n;
}

async function toolCallEnv(extra: Record<string, string>, token: string, name: string, args: Record<string, unknown>) {
  const res = await app.request(
    'https://2yolks.com/api/admin/mcp',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(rpc('tools/call', { name, arguments: args })),
    },
    env(DB, extra),
  );
  const body = (await res.json()) as { result?: { content?: { text: string }[]; isError?: boolean } };
  const text = body.result?.content?.[0]?.text;
  return {
    status: res.status,
    isError: body.result?.isError === true,
    data: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
  };
}

describe('MCP structured ingredients and translation provenance (contracts, migration 0003)', () => {
  beforeEach(() => {
    DB = migratedD1();
  });

  it('accepts structured ingredients with resolvable tokens and stores them verbatim', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...STRUCTURED_RECIPE, confirmed: true });
    expect(created.isError).toBe(false);
    const { id } = created.data as { id: string };
    const row = await DB.prepare('SELECT ingredients_json FROM recipe_locales WHERE recipe_id = ?').bind(id).first<{ ingredients_json: string }>();
    const stored = JSON.parse(row!.ingredients_json) as unknown[];
    expect(stored[0]).toEqual({ ref: 'flour', qty: 2, unit: 'cup', name: 'flour' });
  });

  it('rejects malformed structured ingredients', async () => {
    const base = STRUCTURED_RECIPE.locales[0];
    const bad = [
      [{ ref: 'flour', qty: 2, unit: 'cup', name: 'flour', extra: 'smuggled' }],
      [{ ref: 'Flour!', qty: 2, name: 'flour' }],
      [{ ref: 'flour', qty: 3, qtyEnd: 2, name: 'flour' }],
      [{ ref: 'flour', qty: 2, unit: 'smoot', name: 'flour' }],
      [{ ref: 'flour', qty: Number.NaN, name: 'flour' }],
    ];
    for (const ingredients of bad) {
      const res = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
        ...STRUCTURED_RECIPE,
        locales: [{ ...base, ingredients }],
        confirmed: true,
      });
      expect(res.isError).toBe(true);
    }
    expect(await dbCount('recipes')).toBe(0);
  });

  it('rejects steps that reference unknown ingredient refs', async () => {
    const res = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      ...STRUCTURED_RECIPE,
      locales: [{ ...STRUCTURED_RECIPE.locales[0], steps: ['Whisk {i:butter}.'] }],
      confirmed: true,
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data)).toContain('unknown ingredient refs');
  });

  it('requires exactly one original locale per recipe', async () => {
    const twoOriginals = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      ...TRANSLATED_RECIPE,
      locales: TRANSLATED_RECIPE.locales.map((l) => {
        const { translationOf, translationMethod, ...rest } = l as Record<string, unknown>;
        return rest;
      }),
      confirmed: true,
    });
    expect(twoOriginals.isError).toBe(true);
    expect(JSON.stringify(twoOriginals.data)).toContain('exactly one locale must be the original');
    const ok = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...TRANSLATED_RECIPE, confirmed: true });
    expect(ok.isError).toBe(false);
    const { id } = ok.data as { id: string };
    const row = await DB.prepare("SELECT translation_of, translation_method FROM recipe_locales WHERE recipe_id = ? AND country = 'mx'").bind(id).first<{ translation_of: string; translation_method: string }>();
    expect(row).toEqual({ translation_of: 'us/en', translation_method: 'machine' });
  });

  it('never accepts translation_reviewed_at from content', async () => {
    const res = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      ...TRANSLATED_RECIPE,
      locales: [
        TRANSLATED_RECIPE.locales[0],
        { ...TRANSLATED_RECIPE.locales[1], translation_reviewed_at: '2026-01-01T00:00:00Z' },
      ],
      confirmed: true,
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data)).toContain('server-stamped');
  });

  it('recipes.add_locale adds translation drafts and rejects second originals', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...RECIPE, confirmed: true });
    const recipeId = (created.data as { id: string }).id;
    const asOriginal = await toolCall(EDITOR_KEY, 'recipes.add_locale', {
      id: recipeId,
      confirmed: true,
      locale: { country: 'mx', lang: 'es', title: 'Panqueques', ingredients: ['2 tazas de harina'], steps: ['Mezclar.'] },
    });
    expect(asOriginal.isError).toBe(true);
    expect(JSON.stringify(asOriginal.data)).toContain('translationOf');
    const added = await toolCall(EDITOR_KEY, 'recipes.add_locale', {
      id: recipeId,
      confirmed: true,
      locale: {
        country: 'mx',
        lang: 'es',
        title: 'Panqueques de prueba',
        translationOf: 'us/en',
        translationMethod: 'machine',
        ingredients: ['2 tazas de harina', '2 huevos', '1 taza de leche', '1 pizca de sal'],
        steps: ['Mezclar.', 'Cocinar 2 minutos por lado.', 'Servir.'],
      },
    });
    expect(added.isError).toBe(false);
    const dup = await toolCall(EDITOR_KEY, 'recipes.add_locale', {
      id: recipeId,
      confirmed: true,
      locale: { country: 'mx', lang: 'es', title: 'Otra vez', translationOf: 'us/en', translationMethod: 'human', ingredients: ['x'], steps: ['y'] },
    });
    expect(dup.isError).toBe(true);
  });

  it('translations fail closed while review is disabled, and publish after review when enabled', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...TRANSLATED_RECIPE, confirmed: true });
    const id = (created.data as { id: string }).id;
    await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: `src-${id}`, confirmed: true, notes: 'CC0 verified' });
    // Review tool disabled by default.
    const disabled = await toolCall(ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'checked' });
    expect(disabled.isError).toBe(true);
    expect(JSON.stringify(disabled.data)).toContain('not enabled');
    // Publishing the whole recipe fails closed on the unreviewed translation.
    const pubAll = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(pubAll.isError).toBe(true);
    expect(JSON.stringify(pubAll.data)).toContain('not reviewed');
    // Publish the original only, then review the translation with the flag on.
    const pubOrig = await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'us', lang: 'en', confirmed: true });
    expect(pubOrig.isError).toBe(false);
    const reviewed = await toolCallEnv({ MCP_TRANSLATION_REVIEW: '1' }, ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'Compared against us/en line by line' });
    expect(reviewed.isError).toBe(false);
    const row = await DB.prepare("SELECT translation_reviewed_by, translation_reviewer_kind, translation_reviewed_at FROM recipe_locales WHERE recipe_id = ? AND country = 'mx'").bind(id).first<{ translation_reviewed_by: string; translation_reviewer_kind: string | null; translation_reviewed_at: string }>();
    expect(row!.translation_reviewed_by).toBe('shared-admin-key');
    expect(row!.translation_reviewer_kind).toBeNull();
    expect(row!.translation_reviewed_at).toBeTruthy();
    const pubEs = await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'mx', lang: 'es', confirmed: true });
    expect(pubEs.isError).toBe(false);
  });

  it('create_draft runs the translation QA floor at creation (contract gate)', async () => {
    const bad = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      ...TRANSLATED_RECIPE,
      confirmed: true,
      locales: [
        TRANSLATED_RECIPE.locales[0],
        { ...TRANSLATED_RECIPE.locales[1], steps: ['Mezclar.', 'Cocinar 5 minutos por lado.', 'Servir.'] },
      ],
    });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(bad.data)).toContain('translation check');
  });

  it('mark_reviewed rejects changed numbers and dropped allergens, and audits the failure', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...TRANSLATED_RECIPE, confirmed: true });
    const id = (created.data as { id: string }).id;
    // Break the translation after creation: numbers changed, allergen dropped.
    const broken = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [{ country: 'mx', lang: 'es', steps: ['Mezclar.', 'Cocinar 5 minutos.', 'Servir.'], ingredients: ['2 tazas de harina', '2 huevos', '1 pizca de sal'] }],
    });
    expect(broken.isError).toBe(false);
    await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: `src-${id}`, confirmed: true, notes: 'CC0 verified' });
    await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'us', lang: 'en', confirmed: true });
    const reviewed = await toolCallEnv({ MCP_TRANSLATION_REVIEW: '1' }, ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'attempted' });
    expect(reviewed.isError).toBe(true);
    const problems = JSON.stringify((reviewed.data as { problems: string[] }).problems);
    expect(problems).toContain('numbers changed');
    expect(problems).toContain('allergen');
    const audits = await DB.prepare("SELECT details_json FROM mcp_audit WHERE tool = 'translations.mark_reviewed'").all<{ details_json: string }>();
    expect(audits.results.length).toBe(1);
    expect(audits.results[0]!.details_json).toContain('"ok":false');
  });

  it('mark_reviewed enforces canonical quantity equality on structured ingredients', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', {
      source: STRUCTURED_RECIPE.source,
      originCountry: 'us',
      confirmed: true,
      locales: [
        STRUCTURED_RECIPE.locales[0],
        {
          country: 'mx',
          lang: 'es',
          title: 'Panqueques estructurados',
          translationOf: 'us/en',
          translationMethod: 'machine',
          ingredients: [
            { ref: 'flour', qty: 2, unit: 'cup', name: 'harina' },
            { ref: 'eggs', qty: 2, name: 'huevos' },
            { ref: 'milk', qty: 1, unit: 'cup', name: 'leche' },
          ],
          steps: ['Batir {i:eggs} con {i:flour}.', 'Agregar {i:milk}.', 'Cocinar a {t:350F} por 20 minutos.'],
        },
      ],
    });
    expect(created.isError).toBe(false);
    const id = (created.data as { id: string }).id;
    // Drift the quantity after creation; the review gate must catch it.
    const drift = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [
        {
          country: 'mx',
          lang: 'es',
          ingredients: [
            { ref: 'flour', qty: 2, unit: 'cup', name: 'harina' },
            { ref: 'eggs', qty: 3, name: 'huevos' },
            { ref: 'milk', qty: 1, unit: 'cup', name: 'leche' },
          ],
        },
      ],
    });
    expect(drift.isError).toBe(false);
    await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: `src-${id}`, confirmed: true, notes: 'CC0 verified' });
    await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'us', lang: 'en', confirmed: true });
    const reviewed = await toolCallEnv({ MCP_TRANSLATION_REVIEW: '1' }, ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'attempted' });
    expect(reviewed.isError).toBe(true);
    expect(JSON.stringify((reviewed.data as { problems: string[] }).problems)).toContain('quantity changed');
  });

  it('editing a reviewed translation clears the review stamp', async () => {
    const created = await toolCall(EDITOR_KEY, 'recipes.create_draft', { ...TRANSLATED_RECIPE, confirmed: true });
    const id = (created.data as { id: string }).id;
    await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: `src-${id}`, confirmed: true, notes: 'CC0 verified' });
    await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'us', lang: 'en', confirmed: true });
    await toolCallEnv({ MCP_TRANSLATION_REVIEW: '1' }, ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'checked' });
    const edit = await toolCall(EDITOR_KEY, 'recipes.update_draft', {
      id,
      confirmed: true,
      locales: [{ country: 'mx', lang: 'es', steps: ['Mezclar bien.', 'Cocinar 2 minutos por lado.', 'Servir.'] }],
    });
    expect(edit.isError).toBe(false);
    const row = await DB.prepare("SELECT translation_reviewed_at FROM recipe_locales WHERE recipe_id = ? AND country = 'mx'").bind(id).first<{ translation_reviewed_at: string | null }>();
    expect(row!.translation_reviewed_at).toBeNull();
    const pub = await toolCall(ADMIN_KEY, 'recipes.publish', { id, country: 'mx', lang: 'es', confirmed: true });
    expect(pub.isError).toBe(true);
    expect(JSON.stringify(pub.data)).toContain('not reviewed');
  });
});
