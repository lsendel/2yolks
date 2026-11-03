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
  checkAllergens,
  checkStructuredTranslation,
  checkTranslation,
  ingredientText,
  isStructured,
  unitInfo,
  unknownRefs,
} from '@2yolks/contracts';
import type { IngredientEntry, StructuredIngredient } from '@2yolks/contracts';

export type McpBindings = {
  DB: D1Database;
  ADMIN_MCP_API_KEY?: string;
  MCP_READ_KEY?: string;
  MCP_NAMED_KEYS?: string;
  // Fail-closed gate for translations.mark_reviewed. The human-vs-agent
  // translation publication policy is unresolved, so review stays disabled
  // until that policy decision enables it explicitly.
  MCP_TRANSLATION_REVIEW?: string;
};

type Role = 'viewer' | 'editor' | 'admin';
const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

type NamedKey = { name: string; key: string; role: Role };

type AuthResult =
  | { ok: true; role: Role; actor: string; declared: string | null }
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
  // Actor identity derives only from the authenticated key. X-MCP-Caller is
  // an untrusted attribution hint, recorded as declared_caller, never actor.
  const declared = c.req.header('x-mcp-caller')?.trim() || null;
  if (!token) {
    await tryAudit(env.DB, { actor: declared ?? 'unauthenticated', role: 'none', tool: 'auth', details: { reason: 'missing token' } });
    return {
      ok: false,
      status: 401,
      body: { error: 'unauthorized', message: 'Authorization: Bearer <token> is required' },
    };
  }
  if (env.ADMIN_MCP_API_KEY && (await tokenMatches(token, env.ADMIN_MCP_API_KEY))) {
    return { ok: true, role: 'admin', actor: 'shared-admin-key', declared };
  }
  if (env.MCP_READ_KEY && (await tokenMatches(token, env.MCP_READ_KEY))) {
    return { ok: true, role: 'viewer', actor: 'shared-read-key', declared };
  }
  for (const nk of namedKeys) {
    if (await tokenMatches(token, nk.key)) {
      return { ok: true, role: nk.role, actor: nk.name, declared };
    }
  }
  await tryAudit(env.DB, { actor: declared ?? 'unauthenticated', role: 'none', tool: 'auth', details: { reason: 'invalid token' } });
  return {
    ok: false,
    status: 401,
    body: { error: 'unauthorized', message: 'Invalid Bearer token' },
  };
}

function auditStmt(ctx: CallCtx, tool: string, entityId: string | null, details?: Record<string, unknown>) {
  return ctx.db
    .prepare('INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES (?, ?, ?, ?, ?)')
    .bind(
      ctx.actor,
      ctx.role,
      tool,
      entityId,
      JSON.stringify({ ...(details ?? {}), ...(ctx.declaredCaller ? { declared_caller: ctx.declaredCaller } : {}) }),
    );
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
      'Create a recipe draft (source + locales). Same validation as public submissions: ingredients may be strings or structured {ref, qty, qtyEnd?, unit?, name, note?} objects, exactly one original locale per submission, translations carry translationOf/translationMethod and pass the QA gate at creation. The source is created uncleared, so the recipe cannot be served or published until sources.clear_rights. Executes only with confirmed: true; otherwise validates as a dry run.',
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
      'Update title/intro/ingredients/steps of draft locales. Args: id, locales: [{country, lang, ...fields}]. Published locales are not editable; unpublish first. Translation provenance is fixed at creation; any edit to a translation clears its review stamp.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, locales: { type: 'array' } },
      required: ['id', 'locales'],
    },
  },
  {
    name: 'recipes.add_locale',
    description:
      "Add one draft locale to an existing recipe. Added locales are translations: translationOf ('country/lang' of the original locale) and translationMethod (human|machine) are required, and the translation QA gate runs against the stored source at creation. Ingredients may be strings or structured objects; step {i:ref} tokens must resolve.",
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, locale: { type: 'object' } },
      required: ['id', 'locale'],
    },
  },
  {
    name: 'translations.mark_reviewed',
    description:
      'Stamp a translated draft locale as reviewed after re-running the QA gate against its stored source row (source must be published). Requires confirmed: true and a note; the server stamps time + authenticated reviewer, never caller content. Disabled unless the deployment enables translation review.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        country: { type: 'string' },
        lang: { type: 'string' },
        confirmed: { type: 'boolean' },
        note: { type: 'string' },
      },
      required: ['id', 'country', 'lang', 'confirmed', 'note'],
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
    description:
      'Publish draft blog locales. Blogs carry no source row, so publish needs confirmed: true and a review note (who vetted the post). Args: id, optional country+lang.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        country: { type: 'string' },
        lang: { type: 'string' },
        confirmed: { type: 'boolean' },
        review: { type: 'string' },
      },
      required: ['id', 'confirmed', 'review'],
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
const MAX_LOCALES = 12;
const MAX_BODY_BYTES = 262_144;

const REF_PATTERN = /^[a-z0-9-]{1,40}$/;
// Mirrors the contracts MAX_LEN.item cap for ingredient/step entries.
const MAX_ITEM = 1000;

// Ingredients validation mirrors the shared contract's acceptance rules
// (validateRecipeSubmission) so the MCP never rejects contract-valid content,
// then canonicalizes structured objects down to the contract's fields before
// storage so caller content cannot smuggle extra keys into ingredients_json.
function canonicalizeIngredients(v: unknown): { ok: true; entries: IngredientEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) {
    return { ok: false, error: 'ingredients must be an array of 1-50 entries' };
  }
  const entries: IngredientEntry[] = [];
  for (const entry of v as unknown[]) {
    if (typeof entry === 'string') {
      if (entry.length === 0 || entry.length > MAX_ITEM) return { ok: false, error: 'ingredient strings must be 1-1000 chars' };
      entries.push(entry);
      continue;
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry) || !isStructured(entry)) {
      return { ok: false, error: 'ingredient entries must be strings or {ref, qty, qtyEnd?, unit?, name, note?} objects' };
    }
    if (entry.name.length === 0 || entry.name.length > MAX_ITEM) return { ok: false, error: 'ingredient name must be 1-1000 chars' };
    if (typeof entry.qty === 'number' && (!Number.isFinite(entry.qty) || entry.qty <= 0 || entry.qty > 1e6)) {
      return { ok: false, error: 'ingredient qty must be a finite number in (0, 1e6]' };
    }
    const qtyEnd = entry.qtyEnd;
    if (qtyEnd !== undefined && qtyEnd !== null) {
      if (typeof qtyEnd !== 'number' || !Number.isFinite(qtyEnd) || qtyEnd <= 0 || qtyEnd > 1e6) {
        return { ok: false, error: 'ingredient qtyEnd must be null or a finite number in (0, 1e6]' };
      }
      if (typeof entry.qty === 'number' && qtyEnd < entry.qty) return { ok: false, error: 'ingredient qtyEnd must be >= qty' };
    }
    if (entry.unit !== undefined && entry.unit !== '' && unitInfo(entry.unit) === undefined && entry.qty !== null && !/^[a-z]+$/.test(entry.unit)) {
      return { ok: false, error: `unknown unit: ${entry.unit}` };
    }
    const note = entry.note;
    if (note !== undefined && (typeof note !== 'string' || note.length > MAX_ITEM)) {
      return { ok: false, error: 'ingredient note must be a string of at most 1000 chars' };
    }
    const canonical: StructuredIngredient = { ref: entry.ref, qty: entry.qty, name: entry.name };
    if (qtyEnd !== undefined) canonical.qtyEnd = qtyEnd;
    if (entry.unit !== undefined) canonical.unit = entry.unit;
    if (note !== undefined) canonical.note = note;
    entries.push(canonical);
  }
  return { ok: true, entries };
}

function validateStepsArray(v: unknown): { ok: true; steps: string[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === 'string' && (x as string).length > 0 && (x as string).length <= MAX_ITEM)) {
    return { ok: false, error: 'steps must be a non-empty string array (1-1000 chars each)' };
  }
  return { ok: true, steps: v as string[] };
}

// Steps reference structured ingredient amounts by {i:ref} token; every
// referenced ref must exist so numbers cannot drift from the ingredient list.
function validateStepTokens(steps: string[], entries: IngredientEntry[]): string | null {
  const structured = entries.filter((e): e is StructuredIngredient => typeof e !== 'string');
  for (const step of steps) {
    const missing = unknownRefs(step, structured);
    if (missing.length) {
      return `steps reference unknown ingredient refs: ${[...new Set(missing)].join(', ')}`;
    }
  }
  return null;
}

// The deterministic translation gate, shared by recipes.add_locale (at
// creation) and translations.mark_reviewed (re-verified against the stored
// source row): step numbers/tokens, structured quantity equality, allergen
// terms, and step-token resolution.
function translationGateProblems(source: { ingredients: IngredientEntry[]; steps: string[] }, target: { ingredients: IngredientEntry[]; steps: string[] }): string[] {
  const problems: string[] = [];
  problems.push(...checkTranslation({ steps: source.steps }, { steps: target.steps }).problems);
  problems.push(...checkStructuredTranslation(source.ingredients, target.ingredients).problems);
  problems.push(...checkAllergens(ingredientText(source.ingredients), ingredientText(target.ingredients)).problems);
  const tokenErr = validateStepTokens(target.steps, target.ingredients);
  if (tokenErr) problems.push(tokenErr);
  return problems;
}

// translation_reviewed_at/_by/_kind are server-stamped by
// translations.mark_reviewed, never accepted from caller content.
function rejectCallerReviewFields(l: Record<string, unknown>): string | null {
  for (const k of ['translation_reviewed_at', 'translationReviewedAt', 'translation_reviewed_by', 'translationReviewedBy', 'translation_reviewer_kind', 'translationReviewerKind']) {
    if (l[k] !== undefined) return `${k} is server-stamped by translations.mark_reviewed, never accepted from content`;
  }
  return null;
}

function readProvenance(l: Record<string, unknown>): { of?: string; method?: string } {
  const of = l['translationOf'] ?? l['translation_of'];
  const method = l['translationMethod'] ?? l['translation_method'];
  return {
    of: typeof of === 'string' ? of : undefined,
    method: typeof method === 'string' ? method : undefined,
  };
}

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

type CallCtx = { db: D1Database; role: Role; actor: string; declaredCaller?: string | null; dryRun?: boolean; translationReviewEnabled?: boolean };
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
  // The shared contract validator owns shape, structured ingredients, the
  // exactly-one-original rule and the translation QA floor for multi-locale
  // submissions. Only validated fields reach the insert: injected extras
  // (cleared_at, status) cannot.
  const rawLocales = args['locales'];
  if (Array.isArray(rawLocales) && rawLocales.length > MAX_LOCALES) {
    return { status: 400, data: { error: `at most ${MAX_LOCALES} locales per call` } };
  }
  if (Array.isArray(rawLocales)) {
    for (const entry of rawLocales as unknown[]) {
      if (typeof entry !== 'object' || entry === null) continue;
      const reject = rejectCallerReviewFields(entry as Record<string, unknown>);
      if (reject) return { status: 400, data: { error: reject } };
    }
  }
  const result = validateRecipeSubmission(args);
  if (!result.ok) return { status: 400, data: { error: 'validation failed', failures: result.errors } };
  const sub = result.value;
  // Canonicalize structured ingredients for storage and verify step tokens.
  const storedIngredients: IngredientEntry[][] = [];
  for (const l of sub.locales) {
    const canon = canonicalizeIngredients(l.ingredients);
    if (!canon.ok) return { status: 400, data: { error: canon.error } };
    const tokenErr = validateStepTokens(l.steps, canon.entries);
    if (tokenErr) return { status: 400, data: { error: tokenErr } };
    storedIngredients.push(canon.entries);
  }
  if (ctx.dryRun) {
    return { status: 200, data: { dry_run: true, ok: true, locales: sub.locales.length } };
  }
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
    ...sub.locales.map((l, i) =>
      ctx.db
        .prepare(
          'INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status, translation_of, translation_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          l.country,
          l.lang,
          l.title,
          l.slug ?? slugify(l.title),
          l.intro ?? null,
          JSON.stringify(storedIngredients[i]),
          JSON.stringify(l.steps),
          'draft',
          l.translationOf ?? null,
          l.translationMethod ?? null,
        ),
    ),
    // Audit in the same atomic batch as the write.
    auditStmt(ctx, 'recipes.create_draft', id, { locales: sub.locales.length }),
  ];
  try {
    await ctx.db.batch(statements);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint')) {
      const first = sub.locales[0];
      const existing = first
        ? await ctx.db
            .prepare('SELECT recipe_id FROM recipe_locales WHERE country = ? AND lang = ? AND slug = ?')
            .bind(first.country, first.lang, first.slug ?? slugify(first.title))
            .first<{ recipe_id: string }>()
        : null;
      return { status: 409, data: { error: 'a locale with this country/lang/slug already exists', existing_id: existing?.recipe_id ?? null } };
    }
    throw e;
  }
  return { status: 201, data: { id, source_id: sourceId, status: 'draft', locales: sub.locales.length } };
}

async function callRecipesUpdateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const locales = args['locales'];
  if (!id || !Array.isArray(locales) || locales.length === 0) {
    return { status: 400, data: { error: 'id and non-empty locales array required' } };
  }
  if (locales.length > MAX_LOCALES) return { status: 400, data: { error: `at most ${MAX_LOCALES} locales per call` } };
  const existingRows = await ctx.db
    .prepare('SELECT country, lang, status, ingredients_json, steps_json, translation_of FROM recipe_locales WHERE recipe_id = ?')
    .bind(id)
    .all<{ country: string; lang: string; status: string; ingredients_json: string; steps_json: string; translation_of: string | null }>();
  // Pass 1: validate every locale before any write; a multi-locale call never
  // applies partially.
  type Planned = { key: string; stmt: D1PreparedStatement };
  const planned: Planned[] = [];
  for (const entry of locales as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const l = entry as Record<string, unknown>;
    const reject = rejectCallerReviewFields(l);
    if (reject) return { status: 400, data: { error: reject } };
    if (l['translationOf'] !== undefined || l['translation_of'] !== undefined || l['translationMethod'] !== undefined || l['translation_method'] !== undefined) {
      // Provenance is fixed at creation (create_draft/add_locale): changing it
      // would break the exactly-one-original invariant, so it is not editable.
      return { status: 400, data: { error: 'translation provenance is set at locale creation and is not editable' } };
    }
    const country = str(l['country'], 8);
    const lang = str(l['lang'], 8);
    if (!country || !lang) return { status: 400, data: { error: 'each locale needs country and lang' } };
    const existing = existingRows.results.find((r) => r.country === country && r.lang === lang);
    if (!existing) return { status: 404, data: { error: 'locale not found', id, country, lang } };
    if (existing.status !== 'draft') {
      return { status: 409, data: { error: 'only draft locales are editable', country, lang, status: existing.status } };
    }
    // Stored ingredients may be strings or schema-valid structured objects;
    // anything else is a shape this tool must not rewrite.
    let storedIngredients: IngredientEntry[];
    let storedSteps: string[];
    try {
      storedIngredients = JSON.parse(existing.ingredients_json) as IngredientEntry[];
      storedSteps = JSON.parse(existing.steps_json) as string[];
      const check = canonicalizeIngredients(storedIngredients);
      if (!check.ok || !Array.isArray(storedSteps) || !storedSteps.every((x) => typeof x === 'string')) {
        return { status: 409, data: { error: 'stored locale shape is not editable by this tool version', country, lang } };
      }
    } catch {
      return { status: 409, data: { error: 'stored locale shape is not editable by this tool version', country, lang } };
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
    // Ingredients and steps are validated together: step {i:ref} tokens must
    // resolve against the effective (new or stored) ingredient list.
    let effective: IngredientEntry[] = storedIngredients;
    if (l['ingredients'] !== undefined) {
      const canon = canonicalizeIngredients(l['ingredients']);
      if (!canon.ok) return { status: 400, data: { error: canon.error } };
      effective = canon.entries;
      sets.push('ingredients_json = ?');
      params.push(JSON.stringify(canon.entries));
    }
    if (l['steps'] !== undefined) {
      const steps = validateStepsArray(l['steps']);
      if (!steps.ok) return { status: 400, data: { error: steps.error } };
      const tokenErr = validateStepTokens(steps.steps, effective);
      if (tokenErr) return { status: 400, data: { error: tokenErr } };
      sets.push('steps_json = ?');
      params.push(JSON.stringify(steps.steps));
    } else if (l['ingredients'] !== undefined) {
      // Ingredients changed but steps did not: stored steps must still resolve.
      const tokenErr = validateStepTokens(storedSteps, effective);
      if (tokenErr) return { status: 400, data: { error: tokenErr } };
    }
    if (sets.length > 0 && existing.translation_of !== null) {
      // Any edit to a translation clears its review stamp, so a reviewed
      // translation cannot be silently altered before publish.
      sets.push('translation_reviewed_at = NULL', 'translation_reviewed_by = NULL', 'translation_reviewer_kind = NULL');
    }
    if (!sets.length) continue;
    planned.push({
      key: `${country}/${lang}`,
      stmt: ctx.db
        .prepare(`UPDATE recipe_locales SET ${sets.join(', ')} WHERE recipe_id = ? AND country = ? AND lang = ?`)
        .bind(...params, id, country, lang),
    });
  }
  const updated = planned.map((pl) => pl.key);
  if (ctx.dryRun) return { status: 200, data: { dry_run: true, ok: true, id, updated } };
  if (planned.length) {
    // Content mutation and audit row commit in one atomic batch.
    await ctx.db.batch([...planned.map((pl) => pl.stmt), auditStmt(ctx, 'recipes.update_draft', id, { updated })]);
  }
  return { status: 200, data: { id, updated } };
}

async function callRecipesAddLocale(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const l = (typeof args['locale'] === 'object' && args['locale'] !== null ? args['locale'] : {}) as Record<string, unknown>;
  if (!id) return { status: 400, data: { error: 'id required' } };
  const recipe = await ctx.db.prepare('SELECT id FROM recipes WHERE id = ?').bind(id).first();
  if (!recipe) return { status: 404, data: { error: 'recipe not found', id } };
  const reject = rejectCallerReviewFields(l);
  if (reject) return { status: 400, data: { error: reject } };
  const country = str(l['country'], 8);
  const lang = str(l['lang'], 8);
  const title = str(l['title'], MAX_LEN.title);
  if (!country || !lang || !title) return { status: 400, data: { error: 'locale needs country, lang, title' } };
  if (!getCountry(country)) return { status: 400, data: { error: 'unknown country', country } };
  if (!localesFor(country).includes(lang)) return { status: 400, data: { error: 'locale not enabled for this country', country, lang } };
  const intro = l['intro'] === undefined || l['intro'] === null ? null : str(l['intro'], MAX_LEN.intro);
  if (l['intro'] !== undefined && l['intro'] !== null && !intro) return { status: 400, data: { error: 'invalid intro' } };
  const canon = canonicalizeIngredients(l['ingredients']);
  if (!canon.ok) return { status: 400, data: { error: canon.error } };
  const steps = validateStepsArray(l['steps']);
  if (!steps.ok) return { status: 400, data: { error: steps.error } };
  const tokenErr = validateStepTokens(steps.steps, canon.entries);
  if (tokenErr) return { status: 400, data: { error: tokenErr } };

  const existingRows = await ctx.db
    .prepare('SELECT country, lang, ingredients_json, steps_json, translation_of FROM recipe_locales WHERE recipe_id = ?')
    .bind(id)
    .all<{ country: string; lang: string; ingredients_json: string; steps_json: string; translation_of: string | null }>();
  const knownKeys = new Set(existingRows.results.map((r) => `${r.country}/${r.lang}`));
  if (knownKeys.has(`${country}/${lang}`)) {
    return { status: 409, data: { error: 'locale already exists', id, country, lang } };
  }
  // A locale added to an existing recipe is always a translation: the single
  // original already exists and the new locale must point at it.
  const prov = readProvenance(l);
  if (!prov.of || !prov.method) {
    return { status: 400, data: { error: "added locales must carry translationOf + translationMethod ('human'|'machine')" } };
  }
  if (prov.method !== 'human' && prov.method !== 'machine') {
    return { status: 400, data: { error: "translationMethod must be 'human' or 'machine'" } };
  }
  if (prov.of === `${country}/${lang}`) {
    return { status: 400, data: { error: 'translationOf cannot reference the locale itself' } };
  }
  const source = existingRows.results.find((r) => `${r.country}/${r.lang}` === prov.of);
  if (!source) return { status: 400, data: { error: `translationOf target not found on this recipe: ${prov.of}` } };
  if (source.translation_of !== null) {
    return { status: 400, data: { error: 'translationOf must name the original locale, not another translation' } };
  }
  // The translation QA floor runs at creation, against the stored source row.
  let srcContent: { ingredients: IngredientEntry[]; steps: string[] };
  try {
    srcContent = { ingredients: JSON.parse(source.ingredients_json) as IngredientEntry[], steps: JSON.parse(source.steps_json) as string[] };
  } catch {
    return { status: 409, data: { error: 'stored source locale content is not parseable' } };
  }
  const problems = translationGateProblems(srcContent, { ingredients: canon.entries, steps: steps.steps });
  if (problems.length) {
    return { status: 400, data: { error: 'translation QA gate failed', problems } };
  }
  const slug = str(l['slug'], 200) ?? slugify(title);
  if (!SLUG_PATTERN.test(slug)) return { status: 400, data: { error: 'invalid slug' } };
  if (ctx.dryRun) return { status: 200, data: { dry_run: true, ok: true, id, locale: `${country}/${lang}` } };
  try {
    await ctx.db.batch([
      ctx.db
        .prepare(
          'INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status, translation_of, translation_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, country, lang, title, slug, intro, JSON.stringify(canon.entries), JSON.stringify(steps.steps), 'draft', prov.of, prov.method),
      auditStmt(ctx, 'recipes.add_locale', id, { locale: `${country}/${lang}`, translation_of: prov.of }),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint')) {
      return { status: 409, data: { error: 'a locale with this country/lang/slug already exists', slug } };
    }
    throw e;
  }
  return { status: 201, data: { id, locale: `${country}/${lang}`, status: 'draft', translation_of: prov.of } };
}

async function callMarkReviewed(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  // Fail closed while the human-vs-agent translation publication policy is
  // unresolved: the tool exists only when the deployment opts in.
  if (!ctx.translationReviewEnabled) {
    return { status: 403, data: { error: 'translation review is not enabled on this deployment' } };
  }
  const id = str(args['id'], 64);
  const country = str(args['country'], 8);
  const lang = str(args['lang'], 8);
  if (!id || !country || !lang) return { status: 400, data: { error: 'id, country and lang required' } };
  if (args['confirmed'] !== true) {
    return { status: 400, data: { error: 'confirmed: true required to mark a translation reviewed' } };
  }
  const note = str(args['note'], 500);
  if (!note) return { status: 400, data: { error: 'note required (what the reviewer checked)' } };
  type Row = {
    status: string;
    ingredients_json: string;
    steps_json: string;
    translation_of: string | null;
    translation_reviewed_at: string | null;
  };
  const target = await ctx.db
    .prepare('SELECT status, ingredients_json, steps_json, translation_of, translation_reviewed_at FROM recipe_locales WHERE recipe_id = ? AND country = ? AND lang = ?')
    .bind(id, country, lang)
    .first<Row>();
  if (!target) return { status: 404, data: { error: 'locale not found', id, country, lang } };
  if (target.status !== 'draft') return { status: 409, data: { error: 'only draft locales are reviewed', status: target.status } };
  if (!target.translation_of) return { status: 409, data: { error: 'locale is not a translation (no translation_of)' } };
  if (target.translation_reviewed_at) return { status: 409, data: { error: 'translation already reviewed; editing clears the stamp' } };
  const m = /^([a-z]{2})\/([a-z]{2})$/.exec(target.translation_of);
  if (!m) return { status: 409, data: { error: 'stored translation_of is malformed', translation_of: target.translation_of } };
  const source = await ctx.db
    .prepare('SELECT status, ingredients_json, steps_json FROM recipe_locales WHERE recipe_id = ? AND country = ? AND lang = ?')
    .bind(id, m[1], m[2])
    .first<{ status: string; ingredients_json: string; steps_json: string }>();
  if (!source) return { status: 409, data: { error: 'source locale not found', translation_of: target.translation_of } };
  if (source.status !== 'published') {
    return { status: 409, data: { error: 'source locale must be published before its translations are reviewed', translation_of: target.translation_of } };
  }

  let srcContent: { ingredients: IngredientEntry[]; steps: string[] };
  let dstContent: { ingredients: IngredientEntry[]; steps: string[] };
  try {
    srcContent = { ingredients: JSON.parse(source.ingredients_json) as IngredientEntry[], steps: JSON.parse(source.steps_json) as string[] };
    dstContent = { ingredients: JSON.parse(target.ingredients_json) as IngredientEntry[], steps: JSON.parse(target.steps_json) as string[] };
  } catch {
    return { status: 409, data: { error: 'stored locale content is not parseable' } };
  }
  const problems = translationGateProblems(srcContent, dstContent);

  if (problems.length) {
    // Failed reviews are audited too: the attempt is evidence.
    await ctx.db.batch([
      auditStmt(ctx, 'translations.mark_reviewed', id, { locale: `${country}/${lang}`, ok: false, problems, note }),
    ]);
    return { status: 409, data: { error: 'translation QA gate failed', problems } };
  }
  if (ctx.dryRun) return { status: 200, data: { dry_run: true, ok: true, id, locale: `${country}/${lang}` } };
  // Server stamps the review: time and reviewer come from the authenticated
  // key, never from caller content. reviewer_kind stays NULL: possessing a
  // key proves neither a human nor an agent reviewer.
  await ctx.db.batch([
    ctx.db
      .prepare("UPDATE recipe_locales SET translation_reviewed_at = datetime('now'), translation_reviewed_by = ?, translation_reviewer_kind = NULL WHERE recipe_id = ? AND country = ? AND lang = ?")
      .bind(ctx.actor, id, country, lang),
    auditStmt(ctx, 'translations.mark_reviewed', id, { locale: `${country}/${lang}`, ok: true, translation_of: target.translation_of, note, reviewer: ctx.actor }),
  ]);
  return { status: 200, data: { id, locale: `${country}/${lang}`, reviewed: true, reviewer: ctx.actor } };
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
  const tool = `${kind === 'recipe' ? 'recipes' : 'blog'}.${target === 'published' ? 'publish' : 'unpublish'}`;
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
    if (target === 'published') {
      // A translated locale publishes only after translations.mark_reviewed
      // has stamped it. Unreviewed translations fail closed.
      const conds = ['recipe_id = ?', 'translation_of IS NOT NULL', 'translation_reviewed_at IS NULL', "status = 'draft'"];
      const params: unknown[] = [id];
      if (country && lang) {
        conds.push('country = ?', 'lang = ?');
        params.push(country, lang);
      }
      const unreviewed = await ctx.db
        .prepare(`SELECT country, lang FROM recipe_locales WHERE ${conds.join(' AND ')}`)
        .bind(...params)
        .all<{ country: string; lang: string }>();
      if (unreviewed.results.length) {
        return {
          status: 409,
          data: {
            error: 'translated locales are not reviewed',
            locales: unreviewed.results.map((r) => `${r.country}/${r.lang}`),
            hint: 'translations.mark_reviewed (when translation review is enabled on this deployment)',
          },
        };
      }
    }
  } else {
    const post = await ctx.db.prepare('SELECT id FROM blog_posts WHERE id = ?').bind(id).first();
    if (!post) return { status: 404, data: { error: 'blog post not found', id } };
    // Blog publish has its own vetting gate (blogs carry no source row): an
    // explicit confirmation plus a written review note, both audited.
    if (target === 'published') {
      if (args['confirmed'] !== true) {
        return { status: 400, data: { error: 'confirmed: true required to publish a blog post' } };
      }
      if (!str(args['review'], 2000)) {
        return { status: 400, data: { error: 'review note required (who vetted the post and why it is publishable)' } };
      }
    }
  }
  const from = target === 'published' ? 'draft' : 'published';
  const table = kind === 'recipe' ? 'recipe_locales' : 'blog_post_locales';
  const fk = kind === 'recipe' ? 'recipe_id' : 'post_id';
  const scope = country ? ' AND country = ? AND lang = ?' : '';
  const countBind: unknown[] = country ? [id, country, lang] : [id];
  const matched = await ctx.db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${fk} = ? AND status = '${from}'${scope}`)
    .bind(...countBind)
    .first<{ n: number }>();
  const matchedCount = Number(matched?.n ?? 0);
  if (matchedCount === 0) {
    return { status: 409, data: { error: `no ${from} locales matched`, id, country: country ?? null, lang: lang ?? null } };
  }
  if (ctx.dryRun) {
    return { status: 200, data: { dry_run: true, ok: true, id, would_set: target, matching_locales: matchedCount } };
  }
  const bind: unknown[] = country ? [target, id, country, lang] : [target, id];
  // Content mutation and audit row commit in one atomic batch.
  await ctx.db.batch([
    ctx.db.prepare(`UPDATE ${table} SET status = ? WHERE ${fk} = ? AND status = '${from}'${scope}`).bind(...bind),
    auditStmt(ctx, tool, id, {
      locales_changed: matchedCount,
      ...(country ? { country, lang } : {}),
      ...(kind === 'blog' && target === 'published' ? { review: args['review'] } : {}),
    }),
  ]);
  return { status: 200, data: { id, status: target, locales_changed: matchedCount } };
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
  const updated = sets.map((st) => st.split(' ')[0]);
  if (ctx.dryRun) return { status: 200, data: { dry_run: true, ok: true, id, updated } };
  await ctx.db.batch([
    ctx.db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
    auditStmt(ctx, 'sources.update', id, { updated }),
  ]);
  return { status: 200, data: { id, updated } };
}

async function callSourcesClearRights(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const notes = str(args['notes'], 2000);
  if (!id) return { status: 400, data: { error: 'id required' } };
  if (args['confirmed'] !== true) {
    return { status: 400, data: { error: 'confirmed: true required to clear source rights' } };
  }
  if (!notes) return { status: 400, data: { error: 'notes reason required (what was reviewed)' } };
  const existing = await ctx.db
    .prepare('SELECT id, cleared_at FROM sources WHERE id = ?')
    .bind(id)
    .first<{ id: string; cleared_at: string | null }>();
  if (!existing) return { status: 404, data: { error: 'source not found', id } };
  if (existing.cleared_at !== null) return { status: 409, data: { error: 'source already cleared', id } };
  if (ctx.dryRun) {
    return { status: 200, data: { dry_run: true, ok: true, id } };
  }
  await ctx.db.batch([
    ctx.db.prepare("UPDATE sources SET cleared_at = datetime('now'), notes = ? WHERE id = ? AND cleared_at IS NULL").bind(notes, id),
    auditStmt(ctx, 'sources.clear_rights', id, { notes }),
  ]);
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
  const rawLocales = args['locales'];
  if (Array.isArray(rawLocales) && rawLocales.length > MAX_LOCALES) {
    return { status: 400, data: { error: `at most ${MAX_LOCALES} locales per call` } };
  }
  const validated = validateBlogLocales(args['locales']);
  if (!validated.ok) return { status: 400, data: { error: validated.error } };
  if (ctx.dryRun) {
    return { status: 200, data: { dry_run: true, ok: true, locales: validated.locales.length } };
  }
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
    // Audit in the same atomic batch as the write.
    auditStmt(ctx, 'blog.create_draft', id, { locales: validated.locales.length }),
  ];
  try {
    await ctx.db.batch(statements);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint')) {
      return { status: 409, data: { error: 'a locale with this country/lang/slug already exists' } };
    }
    throw e;
  }
  return { status: 201, data: { id, status: 'draft', locales: validated.locales.length } };
}

async function callBlogUpdateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const locales = args['locales'];
  if (!id || !Array.isArray(locales) || locales.length === 0) {
    return { status: 400, data: { error: 'id and non-empty locales array required' } };
  }
  if (locales.length > MAX_LOCALES) return { status: 400, data: { error: `at most ${MAX_LOCALES} locales per call` } };
  // Pass 1: validate every locale before any write; a multi-locale call never
  // applies partially.
  type Planned = { key: string; stmt: D1PreparedStatement };
  const planned: Planned[] = [];
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
    planned.push({
      key: `${country}/${lang}`,
      stmt: ctx.db
        .prepare(`UPDATE blog_post_locales SET ${sets.join(', ')} WHERE post_id = ? AND country = ? AND lang = ?`)
        .bind(...params, id, country, lang),
    });
  }
  const updated = planned.map((pl) => pl.key);
  if (ctx.dryRun) return { status: 200, data: { dry_run: true, ok: true, id, updated } };
  if (planned.length) {
    // Content mutation, updated_at bump and audit row commit in one batch.
    await ctx.db.batch([
      ...planned.map((pl) => pl.stmt),
      ctx.db.prepare("UPDATE blog_posts SET updated_at = datetime('now') WHERE id = ?").bind(id),
      auditStmt(ctx, 'blog.update_draft', id, { updated }),
    ]);
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
  // Every write commits content + audit in one D1 batch, so an unexpected
  // failure means nothing was written: return a structured, retry-safe 500
  // instead of a bare crash that invites a blind retry.
  try {
    return await dispatch(ctx, name, args);
  } catch {
    return {
      status: 500,
      data: { error: 'write failed before commit; content and audit are atomic, so nothing was written and the call is safe to retry' },
    };
  }
}

async function dispatch(ctx: CallCtx, name: string, args: Record<string, unknown>): Promise<CallResult> {
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
    case 'recipes.add_locale':
      return callRecipesAddLocale(ctx, args);
    case 'translations.mark_reviewed':
      return callMarkReviewed(ctx, args);
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
  const declaredLength = Number(c.req.header('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return c.json({ error: 'request too large', max_bytes: MAX_BODY_BYTES }, 413);
  }
  let body: Record<string, unknown>;
  try {
    const raw = await c.req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return c.json({ error: 'request too large', max_bytes: MAX_BODY_BYTES }, 413);
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bad');
    body = parsed as Record<string, unknown>;
  } catch {
    return c.json(rpcError(null, -32600, 'Invalid Request: single JSON-RPC object expected'), 400);
  }

  const callCtx = {
    db: c.env.DB,
    role: auth.role,
    actor: auth.actor,
    declaredCaller: auth.declared,
    translationReviewEnabled: Boolean(c.env.MCP_TRANSLATION_REVIEW),
  };

  // Write semantics are identical on both wire shapes: an explicit
  // dryRun/dry_run flag wins; otherwise a write tool executes only when the
  // call carries confirmed: true, and dry-runs otherwise. Reads always
  // execute. Every write commits its audit row in the same D1 batch as the
  // content mutation, so a successful response always means audited.
  const dryFlag = (v: unknown) => (v === undefined ? undefined : v !== false);
  const resolveDryRun = (
    tool: ToolDef,
    confirmed: boolean,
    ...flags: unknown[]
  ): boolean => {
    for (const f of flags) {
      const d = dryFlag(f);
      if (d !== undefined) return d;
    }
    return tool.role === 'viewer' ? false : !confirmed;
  };

  // Shorthand wire shape used by the directory MCP clients:
  // { name | tool, arguments | input | params, dryRun?, confirmed? }.
  if (body['jsonrpc'] !== '2.0' && typeof body['method'] !== 'string') {
    const rawName = typeof body['name'] === 'string' ? body['name'] : typeof body['tool'] === 'string' ? body['tool'] : undefined;
    const tool = rawName ? TOOLS.find((t) => t.name === rawName) : undefined;
    if (!tool) {
      return c.json({ error: 'not-registered' }, 404);
    }
    const rawArgs =
      typeof body['arguments'] === 'object' && body['arguments'] !== null && !Array.isArray(body['arguments'])
        ? (body['arguments'] as Record<string, unknown>)
        : typeof body['input'] === 'object' && body['input'] !== null && !Array.isArray(body['input'])
          ? (body['input'] as Record<string, unknown>)
          : typeof body['params'] === 'object' && body['params'] !== null && !Array.isArray(body['params'])
            ? (body['params'] as Record<string, unknown>)
            : {};
    const confirmed = body['confirmed'] === true || rawArgs['confirmed'] === true;
    const dryRun = resolveDryRun(tool, confirmed, body['dryRun'], body['dry_run'], rawArgs['dryRun'], rawArgs['dry_run']);
    const result = await callTool({ ...callCtx, dryRun }, tool.name, rawArgs);
    return c.json(result.data as Record<string, unknown>, result.status as 200);
  }

  // JSON-RPC 2.0 envelope.
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
    const confirmed = params['confirmed'] === true || args['confirmed'] === true;
    const dryRun = resolveDryRun(tool, confirmed, args['dryRun'], args['dry_run'], params['dryRun'], params['dry_run']);
    const result = await callTool({ ...callCtx, dryRun }, name, args);
    if (result.status >= 400) {
      return c.json(toolText(id, result.data, true), 200);
    }
    return c.json(toolText(id, result.data), 200);
  }
  return c.json(rpcError(id, -32601, `Method '${method}' not found`), 404);
}

mcpApp.post('/', handleRpc);
mcpApp.post('/tools', handleRpc);
