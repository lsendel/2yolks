// 2yolks admin MCP: JSON-RPC tools for agent-driven content work
// (recipes, blog posts, publishing), modelled on the directory MCP
// (lsendel/directory packages/api/src/mcp/handler.ts).
//
// Auth: Bearer token, hash-compared against configured secrets.
//   ADMIN_MCP_API_KEY  -> role 'admin'   (shared directory admin bearer)
//   MCP_NAMED_KEYS     -> JSON array [{name, key, role}] for per-agent keys
//   MCP_READ_KEY       -> role 'viewer'  (read-only)
// Roles: viewer < editor < admin. Fail closed: with no keys configured the
// endpoint answers 503 MCP_NOT_CONFIGURED; a missing/invalid token gets 401.
//
// Write rules: draft-first; publish requires a rights-cleared source for
// recipes; unpublish instead of delete (nothing is ever removed); every write
// and every auth denial lands in mcp_audit.
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getCountry,
  localesFor,
  slugify,
  validateRecipeSubmission,
  SLUG_PATTERN,
} from '@2yolks/contracts';

export type McpBindings = {
  DB: D1Database;
  ADMIN_MCP_API_KEY?: string;
  MCP_READ_KEY?: string;
  MCP_NAMED_KEYS?: string;
};

type Role = 'viewer' | 'editor' | 'admin';
const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

type NamedKey = { name: string; key: string; role: Role };

type AuthResult =
  | { ok: true; role: Role; actor: string }
  | { ok: false; status: number; body: Record<string, unknown> };

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function tokenMatches(presented: string, configured: string): Promise<boolean> {
  // Compare hashes so comparison length never leaks the secret's length.
  return (await sha256(presented)) === (await sha256(configured));
}

function parseNamedKeys(raw: string | undefined): NamedKey[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: NamedKey[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const it = item as Record<string, unknown>;
      const role = it['role'];
      if (
        typeof it['name'] === 'string' &&
        typeof it['key'] === 'string' &&
        it['key'].length >= 16 &&
        (role === 'viewer' || role === 'editor' || role === 'admin')
      ) {
        out.push({ name: it['name'], key: it['key'], role });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function recordAudit(
  db: D1Database,
  entry: { actor: string; role: string; tool: string; entityId?: string | null; details?: unknown },
): Promise<void> {
  await db
    .prepare('INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES (?, ?, ?, ?, ?)')
    .bind(entry.actor, entry.role, entry.tool, entry.entityId ?? null, JSON.stringify(entry.details ?? {}))
    .run();
}

async function tryAudit(
  db: D1Database,
  entry: { actor: string; role: string; tool: string; entityId?: string | null; details?: unknown },
): Promise<void> {
  try {
    await recordAudit(db, entry);
  } catch {
    // Best-effort only (auth denials must still answer 401 even before the
    // 0002 migration is applied).
  }
}

async function resolveAuth(c: Context<{ Bindings: McpBindings }>): Promise<AuthResult> {
  const env = c.env;
  const namedKeys = parseNamedKeys(env.MCP_NAMED_KEYS);
  const configured =
    (env.ADMIN_MCP_API_KEY?.trim().length ?? 0) > 0 ||
    (env.MCP_READ_KEY?.trim().length ?? 0) > 0 ||
    namedKeys.length > 0;
  if (!configured) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'MCP_NOT_CONFIGURED',
        message: 'MCP authentication keys are not configured on this worker',
      },
    };
  }
  const header = c.req.header('authorization')?.trim() ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const caller = c.req.header('x-mcp-caller')?.trim() || 'mcp-agent';
  if (!token) {
    await tryAudit(env.DB, { actor: caller, role: 'none', tool: 'auth', details: { reason: 'missing token' } });
    return {
      ok: false,
      status: 401,
      body: { error: 'unauthorized', message: 'Authorization: Bearer <token> is required' },
    };
  }
  if (env.ADMIN_MCP_API_KEY && (await tokenMatches(token, env.ADMIN_MCP_API_KEY))) {
    return { ok: true, role: 'admin', actor: caller };
  }
  if (env.MCP_READ_KEY && (await tokenMatches(token, env.MCP_READ_KEY))) {
    return { ok: true, role: 'viewer', actor: caller };
  }
  for (const nk of namedKeys) {
    if (await tokenMatches(token, nk.key)) {
      return { ok: true, role: nk.role, actor: nk.name };
    }
  }
  await tryAudit(env.DB, { actor: caller, role: 'none', tool: 'auth', details: { reason: 'invalid token' } });
  return {
    ok: false,
    status: 401,
    body: { error: 'unauthorized', message: 'Invalid Bearer token' },
  };
}

// --- Tool catalog -----------------------------------------------------------

type ToolDef = {
  name: string;
  description: string;
  role: Role; // minimum role
  inputSchema: Record<string, unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: 'recipes.list',
    description: 'List recipe locales with source provenance. Optional filters: country, lang, status.',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        lang: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'rejected'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'recipes.get',
    description: 'Get one recipe with all locales and its source. Args: id.',
    role: 'viewer',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'sources.list',
    description: 'List content sources with license and rights-clearance status.',
    role: 'viewer',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'recipes.create_draft',
    description:
      'Create a recipe draft (source + locales). The source is created uncleared, so the recipe cannot be served or published until sources.clear_rights. Same validation as public submissions.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'object' },
        originCountry: { type: 'string' },
        locales: { type: 'array' },
      },
      required: ['source', 'locales'],
    },
  },
  {
    name: 'recipes.update_draft',
    description:
      'Update title/intro/ingredients/steps of draft locales. Args: id, locales: [{country, lang, ...fields}]. Published locales are not editable; unpublish first.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, locales: { type: 'array' } },
      required: ['id', 'locales'],
    },
  },
  {
    name: 'recipes.publish',
    description:
      'Publish draft locales of a recipe. Requires the source to be rights-cleared. Args: id, optional country+lang to publish one locale.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, country: { type: 'string' }, lang: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'recipes.unpublish',
    description: 'Return published locales to draft (hidden, never deleted). Args: id, optional country+lang.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, country: { type: 'string' }, lang: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'sources.update',
    description: 'Update a source name/url/license/notes. Args: id plus fields to change.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string' },
        license: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'sources.clear_rights',
    description:
      'Mark a source rights-reviewed (sets cleared_at), which allows dependent recipes to publish. Requires confirmed: true and a notes reason.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, confirmed: { type: 'boolean' }, notes: { type: 'string' } },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'blog.list',
    description: 'List blog post locales. Optional filters: country, lang, status.',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        lang: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'rejected'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'blog.get',
    description: 'Get one blog post with all locales. Args: id.',
    role: 'viewer',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'blog.create_draft',
    description:
      'Create a blog post draft. Args: author, locales: [{country, lang, title, body, slug?, excerpt?}]. Body is Markdown.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { author: { type: 'string' }, locales: { type: 'array' } },
      required: ['author', 'locales'],
    },
  },
  {
    name: 'blog.update_draft',
    description:
      'Update title/excerpt/body of draft blog locales. Args: id, locales: [{country, lang, ...fields}].',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, locales: { type: 'array' } },
      required: ['id', 'locales'],
    },
  },
  {
    name: 'blog.publish',
    description: 'Publish draft blog locales. Args: id, optional country+lang.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, country: { type: 'string' }, lang: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'blog.unpublish',
    description: 'Return published blog locales to draft (hidden, never deleted). Args: id, optional country+lang.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, country: { type: 'string' }, lang: { type: 'string' } },
      required: ['id'],
    },
  },
];

const MAX_LEN = { title: 200, intro: 2000, item: 500, excerpt: 500, body: 20000, author: 100 };

// --- Helpers ----------------------------------------------------------------

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function toolText(id: unknown, data: unknown, isError = false) {
  return rpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  });
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8).toLowerCase();
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

function limitArg(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 100;
  return Math.min(Math.max(n, 1), 500);
}

// --- Tool handlers ------------------------------------------------------------
// Each returns { status, data }; data is an error body when status >= 400.

type CallCtx = { db: D1Database; role: Role; actor: string };
type CallResult = { status: number; data: unknown };

async function callRecipesList(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const conds: string[] = [];
  const params: unknown[] = [];
  for (const col of ['country', 'lang', 'status'] as const) {
    const v = args[col];
    if (typeof v === 'string' && v) {
      conds.push(`rl.${col} = ?`);
      params.push(v);
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db
    .prepare(
      `SELECT rl.recipe_id AS id, rl.country, rl.lang, rl.slug, rl.title, rl.status,
              r.origin_country, s.id AS source_id, s.name AS source_name, s.license,
              s.cleared_at IS NOT NULL AS source_cleared
       FROM recipe_locales rl
       JOIN recipes r ON r.id = rl.recipe_id
       JOIN sources s ON s.id = r.source_id
       ${where} ORDER BY rl.country, rl.lang, rl.slug LIMIT ?`,
    )
    .bind(...params, limitArg(args['limit']))
    .all();
  return { status: 200, data: { recipes: rows.results } };
}

async function callRecipesGet(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  if (!id) return { status: 400, data: { error: 'id required' } };
  const recipe = await db.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first();
  if (!recipe) return { status: 404, data: { error: 'recipe not found', id } };
  const locales = await db.prepare('SELECT * FROM recipe_locales WHERE recipe_id = ?').bind(id).all();
  const source = await db
    .prepare('SELECT * FROM sources WHERE id = ?')
    .bind((recipe as Record<string, unknown>)['source_id'] as string)
    .first();
  return { status: 200, data: { recipe, locales: locales.results, source } };
}

async function callSourcesList(db: D1Database): Promise<CallResult> {
  const rows = await db
    .prepare('SELECT id, name, url, license, cleared_at, notes FROM sources ORDER BY id')
    .all();
  return { status: 200, data: { sources: rows.results } };
}

async function callRecipesCreateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const result = validateRecipeSubmission(args);
  if (!result.ok) return { status: 400, data: { error: 'validation failed', failures: result.errors } };
  const sub = result.value;
  const id = newId();
  const sourceId = `src-${id}`;
  const now = new Date().toISOString();
  const statements = [
    ctx.db
      .prepare('INSERT INTO sources (id, name, url, license, cleared_at, notes) VALUES (?, ?, ?, ?, NULL, ?)')
      .bind(sourceId, sub.source.name, sub.source.url, sub.source.license, 'mcp draft - rights review pending'),
    ctx.db
      .prepare('INSERT INTO recipes (id, source_id, origin_country, image_key, created_at) VALUES (?, ?, ?, NULL, ?)')
      .bind(id, sourceId, sub.originCountry ?? null, now),
    ...sub.locales.map((l) =>
      ctx.db
        .prepare(
          'INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          l.country,
          l.lang,
          l.title,
          l.slug ?? slugify(l.title),
          l.intro ?? null,
          JSON.stringify(l.ingredients),
          JSON.stringify(l.steps),
          'draft',
        ),
    ),
  ];
  await ctx.db.batch(statements);
  return { status: 201, data: { id, source_id: sourceId, status: 'draft', locales: sub.locales.length } };
}

async function callRecipesUpdateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const locales = args['locales'];
  if (!id || !Array.isArray(locales) || locales.length === 0) {
    return { status: 400, data: { error: 'id and non-empty locales array required' } };
  }
  const updated: string[] = [];
  for (const entry of locales as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const l = entry as Record<string, unknown>;
    const country = str(l['country'], 8);
    const lang = str(l['lang'], 8);
    if (!country || !lang) return { status: 400, data: { error: 'each locale needs country and lang' } };
    const existing = await ctx.db
      .prepare('SELECT status FROM recipe_locales WHERE recipe_id = ? AND country = ? AND lang = ?')
      .bind(id, country, lang)
      .first<{ status: string }>();
    if (!existing) return { status: 404, data: { error: 'locale not found', id, country, lang } };
    if (existing.status !== 'draft') {
      return { status: 409, data: { error: 'only draft locales are editable', country, lang, status: existing.status } };
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (l['title'] !== undefined) {
      const title = str(l['title'], MAX_LEN.title);
      if (!title) return { status: 400, data: { error: 'invalid title' } };
      sets.push('title = ?');
      params.push(title);
    }
    if (l['intro'] !== undefined) {
      const intro = l['intro'] === null ? null : str(l['intro'], MAX_LEN.intro);
      if (l['intro'] !== null && !intro) return { status: 400, data: { error: 'invalid intro' } };
      sets.push('intro = ?');
      params.push(intro);
    }
    for (const col of ['ingredients', 'steps'] as const) {
      const arr = l[col];
      if (arr === undefined) continue;
      if (!Array.isArray(arr) || arr.length === 0 || !arr.every((x) => typeof x === 'string' && x.length > 0 && x.length <= MAX_LEN.item)) {
        return { status: 400, data: { error: `${col} must be a non-empty string array` } };
      }
      sets.push(`${col}_json = ?`);
      params.push(JSON.stringify(arr));
    }
    if (!sets.length) continue;
    await ctx.db
      .prepare(`UPDATE recipe_locales SET ${sets.join(', ')} WHERE recipe_id = ? AND country = ? AND lang = ?`)
      .bind(...params, id, country, lang)
      .run();
    updated.push(`${country}/${lang}`);
  }
  return { status: 200, data: { id, updated } };
}

async function callStatusChange(
  ctx: CallCtx,
  args: Record<string, unknown>,
  kind: 'recipe' | 'blog',
  target: 'published' | 'draft',
): Promise<CallResult> {
  const id = str(args['id'], 64);
  if (!id) return { status: 400, data: { error: 'id required' } };
  const country = str(args['country'], 8);
  const lang = str(args['lang'], 8);
  if ((country && !lang) || (!country && lang)) {
    return { status: 400, data: { error: 'country and lang must be given together' } };
  }
  if (kind === 'recipe') {
    const recipe = await ctx.db
      .prepare('SELECT r.id, s.cleared_at FROM recipes r JOIN sources s ON s.id = r.source_id WHERE r.id = ?')
      .bind(id)
      .first<{ id: string; cleared_at: string | null }>();
    if (!recipe) return { status: 404, data: { error: 'recipe not found', id } };
    if (target === 'published' && !recipe.cleared_at) {
      return {
        status: 409,
        data: { error: 'source rights not cleared', id, hint: 'sources.clear_rights after rights review' },
      };
    }
  } else {
    const post = await ctx.db.prepare('SELECT id FROM blog_posts WHERE id = ?').bind(id).first();
    if (!post) return { status: 404, data: { error: 'blog post not found', id } };
  }
  const from = target === 'published' ? 'draft' : 'published';
  const table = kind === 'recipe' ? 'recipe_locales' : 'blog_post_locales';
  const fk = kind === 'recipe' ? 'recipe_id' : 'post_id';
  const scope = country ? ' AND country = ? AND lang = ?' : '';
  const bind: unknown[] = country ? [target, id, country, lang] : [target, id];
  const res = await ctx.db
    .prepare(`UPDATE ${table} SET status = ? WHERE ${fk} = ? AND status = '${from}'${scope}`)
    .bind(...bind)
    .run();
  const changes = res.meta.changes ?? 0;
  if (changes === 0) {
    return { status: 409, data: { error: `no ${from} locales matched`, id, country: country ?? null, lang: lang ?? null } };
  }
  return { status: 200, data: { id, status: target, locales_changed: changes } };
}

async function callSourcesUpdate(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  if (!id) return { status: 400, data: { error: 'id required' } };
  const existing = await ctx.db.prepare('SELECT id FROM sources WHERE id = ?').bind(id).first();
  if (!existing) return { status: 404, data: { error: 'source not found', id } };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const col of ['name', 'url', 'license', 'notes'] as const) {
    const v = args[col];
    if (v === undefined) continue;
    if (v !== null && typeof v !== 'string') return { status: 400, data: { error: `${col} must be a string` } };
    if (col === 'url' && typeof v === 'string' && !(v.startsWith('https://') || v.startsWith('internal:'))) {
      return { status: 400, data: { error: 'url must be https:// (or internal: for dev fixtures)' } };
    }
    sets.push(`${col} = ?`);
    params.push(v);
  }
  if (!sets.length) return { status: 400, data: { error: 'no fields to update' } };
  await ctx.db
    .prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params, id)
    .run();
  return { status: 200, data: { id, updated: sets.map((s) => s.split(' ')[0]) } };
}

async function callSourcesClearRights(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const notes = str(args['notes'], 2000);
  if (!id) return { status: 400, data: { error: 'id required' } };
  if (args['confirmed'] !== true) {
    return { status: 400, data: { error: 'confirmed: true required to clear source rights' } };
  }
  if (!notes) return { status: 400, data: { error: 'notes reason required (what was reviewed)' } };
  const res = await ctx.db
    .prepare("UPDATE sources SET cleared_at = datetime('now'), notes = ? WHERE id = ? AND cleared_at IS NULL")
    .bind(notes, id)
    .run();
  if ((res.meta.changes ?? 0) === 0) {
    const existing = await ctx.db.prepare('SELECT id FROM sources WHERE id = ?').bind(id).first();
    if (!existing) return { status: 404, data: { error: 'source not found', id } };
    return { status: 409, data: { error: 'source already cleared', id } };
  }
  return { status: 200, data: { id, cleared: true } };
}

type BlogLocaleInput = {
  country: string;
  lang: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
};

function validateBlogLocales(raw: unknown): { ok: true; locales: BlogLocaleInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'non-empty locales array required' };
  const seen = new Set<string>();
  const out: BlogLocaleInput[] = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return { ok: false, error: 'each locale must be an object' };
    const l = entry as Record<string, unknown>;
    const country = str(l['country'], 8);
    const lang = str(l['lang'], 8);
    const title = str(l['title'], MAX_LEN.title);
    const body = str(l['body'], MAX_LEN.body);
    const excerpt = l['excerpt'] === undefined || l['excerpt'] === null ? null : str(l['excerpt'], MAX_LEN.excerpt);
    if (!country || !getCountry(country)) return { ok: false, error: 'unknown country' };
    if (!lang || !localesFor(country).includes(lang)) return { ok: false, error: `locale ${lang ?? ''} not enabled for ${country}` };
    if (!title) return { ok: false, error: 'title required (max 200 chars)' };
    if (!body) return { ok: false, error: 'body required (max 20000 chars)' };
    if (l['excerpt'] !== undefined && l['excerpt'] !== null && !excerpt) return { ok: false, error: 'invalid excerpt' };
    const slug =
      l['slug'] === undefined ? slugify(title as string) : typeof l['slug'] === 'string' ? l['slug'] : '';
    if (!SLUG_PATTERN.test(slug)) return { ok: false, error: 'slug must match slug pattern' };
    const key = `${country}:${lang}`;
    if (seen.has(key)) return { ok: false, error: 'duplicate country+lang locale' };
    seen.add(key);
    out.push({ country, lang, title, slug, excerpt, body });
  }
  return { ok: true, locales: out };
}

async function callBlogList(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const conds: string[] = [];
  const params: unknown[] = [];
  for (const col of ['country', 'lang', 'status'] as const) {
    const v = args[col];
    if (typeof v === 'string' && v) {
      conds.push(`bl.${col} = ?`);
      params.push(v);
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db
    .prepare(
      `SELECT bl.post_id AS id, bl.country, bl.lang, bl.slug, bl.title, bl.excerpt, bl.status,
              b.author, b.created_at, b.updated_at
       FROM blog_post_locales bl JOIN blog_posts b ON b.id = bl.post_id
       ${where} ORDER BY b.created_at DESC LIMIT ?`,
    )
    .bind(...params, limitArg(args['limit']))
    .all();
  return { status: 200, data: { posts: rows.results } };
}

async function callBlogGet(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  if (!id) return { status: 400, data: { error: 'id required' } };
  const post = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first();
  if (!post) return { status: 404, data: { error: 'blog post not found', id } };
  const locales = await db.prepare('SELECT * FROM blog_post_locales WHERE post_id = ?').bind(id).all();
  return { status: 200, data: { post, locales: locales.results } };
}

async function callBlogCreateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const author = str(args['author'], MAX_LEN.author);
  if (!author) return { status: 400, data: { error: 'author required (max 100 chars)' } };
  const validated = validateBlogLocales(args['locales']);
  if (!validated.ok) return { status: 400, data: { error: validated.error } };
  const id = newId();
  const statements = [
    ctx.db.prepare('INSERT INTO blog_posts (id, author) VALUES (?, ?)').bind(id, author),
    ...validated.locales.map((l) =>
      ctx.db
        .prepare(
          'INSERT INTO blog_post_locales (post_id, country, lang, title, slug, excerpt, body, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, l.country, l.lang, l.title, l.slug, l.excerpt, l.body, 'draft'),
    ),
  ];
  await ctx.db.batch(statements);
  return { status: 201, data: { id, status: 'draft', locales: validated.locales.length } };
}

async function callBlogUpdateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const locales = args['locales'];
  if (!id || !Array.isArray(locales) || locales.length === 0) {
    return { status: 400, data: { error: 'id and non-empty locales array required' } };
  }
  const updated: string[] = [];
  for (const entry of locales as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const l = entry as Record<string, unknown>;
    const country = str(l['country'], 8);
    const lang = str(l['lang'], 8);
    if (!country || !lang) return { status: 400, data: { error: 'each locale needs country and lang' } };
    const existing = await ctx.db
      .prepare('SELECT status FROM blog_post_locales WHERE post_id = ? AND country = ? AND lang = ?')
      .bind(id, country, lang)
      .first<{ status: string }>();
    if (!existing) return { status: 404, data: { error: 'locale not found', id, country, lang } };
    if (existing.status !== 'draft') {
      return { status: 409, data: { error: 'only draft locales are editable', country, lang, status: existing.status } };
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (l['title'] !== undefined) {
      const title = str(l['title'], MAX_LEN.title);
      if (!title) return { status: 400, data: { error: 'invalid title' } };
      sets.push('title = ?');
      params.push(title);
    }
    if (l['excerpt'] !== undefined) {
      const excerpt = l['excerpt'] === null ? null : str(l['excerpt'], MAX_LEN.excerpt);
      if (l['excerpt'] !== null && !excerpt) return { status: 400, data: { error: 'invalid excerpt' } };
      sets.push('excerpt = ?');
      params.push(excerpt);
    }
    if (l['body'] !== undefined) {
      const body = str(l['body'], MAX_LEN.body);
      if (!body) return { status: 400, data: { error: 'invalid body' } };
      sets.push('body = ?');
      params.push(body);
    }
    if (!sets.length) continue;
    await ctx.db
      .prepare(`UPDATE blog_post_locales SET ${sets.join(', ')} WHERE post_id = ? AND country = ? AND lang = ?`)
      .bind(...params, id, country, lang)
      .run();
    updated.push(`${country}/${lang}`);
  }
  if (updated.length) {
    await ctx.db.prepare("UPDATE blog_posts SET updated_at = datetime('now') WHERE id = ?").bind(id).run();
  }
  return { status: 200, data: { id, updated } };
}

// --- Dispatch -----------------------------------------------------------------

async function callTool(ctx: CallCtx, name: string, args: Record<string, unknown>): Promise<CallResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { status: 404, data: { error: `tool '${name}' not registered` } };
  if (ROLE_RANK[ctx.role] < ROLE_RANK[tool.role]) {
    return {
      status: 403,
      data: { error: 'insufficient role', tool: name, needs: tool.role, has: ctx.role },
    };
  }
  switch (name) {
    case 'recipes.list':
      return callRecipesList(ctx.db, args);
    case 'recipes.get':
      return callRecipesGet(ctx.db, args);
    case 'sources.list':
      return callSourcesList(ctx.db);
    case 'recipes.create_draft':
      return callRecipesCreateDraft(ctx, args);
    case 'recipes.update_draft':
      return callRecipesUpdateDraft(ctx, args);
    case 'recipes.publish':
      return callStatusChange(ctx, args, 'recipe', 'published');
    case 'recipes.unpublish':
      return callStatusChange(ctx, args, 'recipe', 'draft');
    case 'sources.update':
      return callSourcesUpdate(ctx, args);
    case 'sources.clear_rights':
      return callSourcesClearRights(ctx, args);
    case 'blog.list':
      return callBlogList(ctx.db, args);
    case 'blog.get':
      return callBlogGet(ctx.db, args);
    case 'blog.create_draft':
      return callBlogCreateDraft(ctx, args);
    case 'blog.update_draft':
      return callBlogUpdateDraft(ctx, args);
    case 'blog.publish':
      return callStatusChange(ctx, args, 'blog', 'published');
    case 'blog.unpublish':
      return callStatusChange(ctx, args, 'blog', 'draft');
    default:
      return { status: 404, data: { error: `tool '${name}' not registered` } };
  }
}

// --- HTTP routes --------------------------------------------------------------

export const mcpApp = new Hono<{ Bindings: McpBindings }>();

mcpApp.get('/tools', async (c) => {
  const auth = await resolveAuth(c);
  if (!auth.ok) return c.json(auth.body, auth.status as 401);
  const tools = TOOLS.filter((t) => ROLE_RANK[auth.role] >= ROLE_RANK[t.role]);
  return c.json({ server: '2yolks-mcp', version: 1, role: auth.role, tools });
});

async function handleRpc(c: Context<{ Bindings: McpBindings }>) {
  const auth = await resolveAuth(c);
  if (!auth.ok) return c.json(auth.body, auth.status as 401);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await c.req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bad');
    body = parsed as Record<string, unknown>;
  } catch {
    return c.json(rpcError(null, -32600, 'Invalid Request: single JSON-RPC object expected'), 400);
  }
  const id = body['id'] ?? null;
  const method = typeof body['method'] === 'string' ? body['method'] : '';
  const params =
    typeof body['params'] === 'object' && body['params'] !== null && !Array.isArray(body['params'])
      ? (body['params'] as Record<string, unknown>)
      : {};

  if (method === 'initialize') {
    return c.json(
      rpcResult(id, {
        protocolVersion: '2025-03-26',
        serverInfo: { name: '2yolks-mcp', version: '1' },
        capabilities: { tools: {} },
      }),
    );
  }
  if (method === 'notifications/initialized' || method === 'ping') {
    return c.json(rpcResult(id, { ok: true }));
  }
  if (method === 'tools/list') {
    const tools = TOOLS.filter((t) => ROLE_RANK[auth.role] >= ROLE_RANK[t.role]);
    return c.json(rpcResult(id, { tools }));
  }
  if (method === 'tools/describe' || method === 'tools/get') {
    const name = typeof params['name'] === 'string' ? params['name'] : '';
    const found = TOOLS.find((t) => t.name === name);
    if (!found || ROLE_RANK[auth.role] < ROLE_RANK[found.role]) {
      return c.json(rpcError(id, -32601, `Tool '${name}' not found`), 404);
    }
    return c.json(rpcResult(id, { tool: found }));
  }
  if (method === 'tools/call') {
    const name = typeof params['name'] === 'string' ? params['name'] : '';
    const args =
      typeof params['arguments'] === 'object' && params['arguments'] !== null && !Array.isArray(params['arguments'])
        ? (params['arguments'] as Record<string, unknown>)
        : {};
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return c.json(rpcError(id, -32601, `Tool '${name}' not registered`), 404);
    const result = await callTool({ db: c.env.DB, role: auth.role, actor: auth.actor }, name, args);
    if (tool.role !== 'viewer') {
      // Write tools must be audited. The audit insert runs after the write;
      // if it fails the caller gets an explicit unconfirmed-write signal
      // instead of a silent success.
      const entity = typeof args['id'] === 'string' ? (args['id'] as string) : null;
      const summary: Record<string, unknown> = { status: result.status };
      if (typeof (result.data as Record<string, unknown> | null)?.['id'] === 'string') {
        summary['result_id'] = (result.data as Record<string, unknown>)['id'];
      }
      if (typeof args['country'] === 'string') summary['country'] = args['country'];
      if (typeof args['lang'] === 'string') summary['lang'] = args['lang'];
      try {
        await recordAudit(c.env.DB, { actor: auth.actor, role: auth.role, tool: name, entityId: entity ?? (summary['result_id'] as string | undefined) ?? null, details: summary });
      } catch {
        return c.json(
          toolText(id, { error: 'write may have applied but the audit insert failed; verify before retrying', tool: name }, true),
          500,
        );
      }
    }
    if (result.status >= 400) {
      return c.json(toolText(id, result.data, true), 200);
    }
    return c.json(toolText(id, result.data), 200);
  }
  return c.json(rpcError(id, -32601, `Method '${method}' not found`), 404);
}

mcpApp.post('/', handleRpc);
mcpApp.post('/tools', handleRpc);
