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
  invalidDurationTokens,
  isStructured,
  parseCategoryField,
  parseTimeFields,
  RECIPE_CATEGORY_SLUGS,
  unitInfo,
  unknownRefs,
} from '@2yolks/contracts';
import type { IngredientEntry, StructuredIngredient } from '@2yolks/contracts';

export type McpBindings = {
  DB: D1Database;
  /** R2 bucket for rights-tracked recipe images (migration 0004). Unset =
   * recipes.set_image answers 503 and /img/recipe/* 404s. */
  IMAGES?: R2Bucket;
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
    description: 'List recipe locales with source provenance. Optional filters: country, lang, status, submitted (true = user submissions waiting for review).',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        lang: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'rejected'] },
        submitted: { type: 'boolean' },
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
    name: 'search.gap_logs',
    description: 'List recent zero-result search queries logged from discovery index searches. Args: limit (optional, max 100).',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'recipes.create_draft',
    description:
      'Create a recipe draft (source + locales). Same validation as public submissions: ingredients may be strings or structured {ref, qty, qtyEnd?, unit?, name, note?} objects, exactly one original locale per submission, translations carry translationOf/translationMethod and pass the QA gate at creation. Optional recipe-level fields (migration 0004): prepMinutes/cookMinutes/restMinutes/totalMinutes (integers, total stored explicitly, never summed), baseServings (numeric base yield), category (dish-type slug, see contracts RECIPE_CATEGORY_SLUGS). Steps may carry {d:Nm} duration tokens (1-1440 minutes) that render localized and drive the cook-mode timer. The source is created uncleared, so the recipe cannot be served or published until sources.clear_rights. Executes only with confirmed: true; otherwise validates as a dry run.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'object' },
        originCountry: { type: 'string' },
        locales: { type: 'array' },
        category: {
          type: 'string',
          enum: RECIPE_CATEGORY_SLUGS as unknown as string[],
          description: 'Primary dish-type category slug',
        },
      },
      required: ['source', 'locales'],
    },
  },
  {
    name: 'recipes.update_draft',
    description:
      'Update title/intro/ingredients/steps of draft locales. Args: id, locales: [{country, lang, ...fields}]. Published locales are not editable; unpublish first. Translation provenance is fixed at creation; any edit to a translation clears its review stamp. Also updates recipe-level fields independently of locale state: prepMinutes/cookMinutes/restMinutes/totalMinutes, baseServings, category (null clears a field).',
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
    name: 'recipes.list_test_reports',
    description:
      'List community kitchen-test reports (the community-tested queue). Args: optional status (pending|approved|rejected, default pending). Returns report id, recipe id + published title, cook display name, note and created_at.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string' } },
    },
  },
  {
    name: 'recipes.moderate_test_report',
    description:
      'Approve or reject a community kitchen-test report. Args: id (report id), decision (approve|reject). Executes only with confirmed: true; otherwise validates as a dry run. On approve the recipe is stamped tested_at = the report creation time and tested_by = the cook\'s display name, only while tested_at is still empty - the first approved report wins, later approvals only corroborate. Rejection hides the report; nothing is deleted.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, decision: { type: 'string' } },
      required: ['id', 'decision'],
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
    name: 'recipes.set_image',
    description:
      'Attach a rights-tracked image to a recipe: hero (default) or one step (kind + stepIndex). Binary upload only via imageBase64 - jpeg/png/webp, max ~3MB, 4096px and 16MP. Container-level structural validation: full JPEG marker walk to a terminal EOI, PNG chunk CRCs plus exact scanline verification of the inflated stream, exact WebP RIFF length - truncation, CRC corruption, trailing polyglot bytes, decompression bombs and oversize are rejected. Not detected: JPEG/WebP compressed-bitstream corruption that preserves container structure (no pixel decode in this runtime; images serve with nosniff as the backstop). No SVG, no URL fetching. Provenance metadata required: sourceName, sourceUrl (https://), license, and style (photo|illustration|graphic) as the honest-imagery label. Provenance is NOT clearance: the call must also carry rightsConfirmed: true, asserting the license was actually verified to permit this use; that assertion scopes to this one asset and clears nothing else. The image is stamped cleared_at and served at /img/recipe/<image_id> only while cleared AND the recipe has a published, rights-cleared locale. A new hero replaces the current hero (nothing is deleted; latest wins) and updates recipes.image_key. Executes only with confirmed: true; otherwise validates as a dry run.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        kind: { type: 'string' },
        stepIndex: { type: 'number' },
        imageBase64: { type: 'string' },
        sourceName: { type: 'string' },
        sourceUrl: { type: 'string' },
        license: { type: 'string' },
        style: { type: 'string' },
        rightsConfirmed: { type: 'boolean' },
      },
      required: ['id', 'imageBase64', 'sourceName', 'sourceUrl', 'license', 'style', 'rightsConfirmed'],
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
    const badDurations = invalidDurationTokens(step);
    if (badDurations.length) {
      return `steps carry invalid duration tokens: ${[...new Set(badDurations)].join(', ')} (use {d:Nm} with 1-1440 minutes)`;
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

// --- Image validation (recipes.set_image) -------------------------------------
// Bytes arrive base64 inside the JSON-RPC call; there is deliberately no
// URL-fetch mode, so the worker never makes a server-side request to a
// caller-supplied address (no SSRF). Validation is structural, not a
// magic-byte sniff: an accepted file must parse END-TO-END as its detected
// type - JPEG markers walked to a terminal EOI, PNG chunks walked with CRC32
// verification to a final IEND with the IDAT stream inflated and verified
// scanline-by-scanline (exact size, filter types 0-4, Adam7 passes handled;
// decompression bombs fail here), WebP RIFF length reconciled exactly.
// Truncated, malformed, dimension-capped, or trailing-byte (polyglot) files
// are rejected, as are types we cannot verify (SVG, avif, gif, ...).
// Known bound: JPEG/WebP COMPRESSED-BITSTREAM corruption that preserves
// container structure is not detected (no pixel decode in this runtime);
// nosniff serving is the backstop there.
const MAX_IMAGE_BASE64 = 4_200_000; // ~3.1 MB decoded
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_DIM = 4096;
const MAX_IMAGE_PIXELS = 16_777_216; // bounds any decoder to ~64 MB RGBA
const IMAGE_STYLES = new Set(['photo', 'illustration', 'graphic']);

function decodeBase64(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length % 4 !== 0) return null;
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

type ImageInfo = { mime: string; ext: string; width: number; height: number };

function dimsOk(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_DIM &&
    height <= MAX_IMAGE_DIM &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

// PNG CRC-32 (ISO-HDLC), table-driven.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = (CRC_TABLE[(c ^ b[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

// Inflate a zlib stream fully, answering null on any stream error or the
// moment the decoded size passes cap - a bomb never gets to expand fully.
async function inflateMax(deflated: Uint8Array, cap: number): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([deflated as BlobPart]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const v = value as Uint8Array;
      total += v.byteLength;
      if (total > cap) {
        await reader.cancel('decompressed size cap exceeded');
        return null;
      }
      parts.push(v);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  } catch {
    return null;
  }
}

const ADAM7: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

// Exact inflated size: per pass, ph rows of (1 filter byte + rowBytes).
function pngExpectedScanlineBytes(width: number, height: number, bppBits: number, interlace: number): number {
  let total = 0;
  const pass = (pw: number, ph: number) => {
    total += ph * (1 + Math.ceil((pw * bppBits) / 8));
  };
  if (interlace === 0) {
    pass(width, height);
  } else {
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
      const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
      if (pw > 0 && ph > 0) pass(pw, ph);
    }
  }
  return total;
}

// Pixel-structure check without unfiltering: every scanline must start with
// a valid filter type (0-4) and the walk must consume the inflated data
// exactly - neither truncated nor overlong streams pass.
function pngScanlinesOk(raw: Uint8Array, width: number, height: number, bppBits: number, interlace: number): boolean {
  const rows: [number, number][] = [];
  if (interlace === 0) {
    rows.push([width, height]);
  } else {
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
      const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
      if (pw > 0 && ph > 0) rows.push([pw, ph]);
    }
  }
  let off = 0;
  for (const [pw, ph] of rows) {
    const rowBytes = Math.ceil((pw * bppBits) / 8);
    for (let r = 0; r < ph; r++) {
      if (off + 1 + rowBytes > raw.length) return false;
      if (raw[off]! > 4) return false;
      off += 1 + rowBytes;
    }
  }
  return off === raw.length;
}

// JPEG: SOI, marker segments (in any order), SOS entropy scans, terminal
// EOI with zero trailing bytes. One frame (SOF) only.
function validateJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  let info: ImageInfo | null = null;
  let markers = 0;
  while (i < b.length) {
    if (++markers > 10000) return null;
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // fill bytes before a marker
    if (i >= b.length) return null;
    const marker = b[i]!;
    i++;
    if (marker === 0x00) return null; // stuffed byte outside entropy data
    if (marker === 0xd9) return i === b.length ? info : null; // EOI: terminal only
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // standalone
    if (i + 2 > b.length) return null;
    const len = (b[i]! << 8) | b[i + 1]!;
    if (len < 2 || i + len > b.length) return null;
    if (marker === 0xda) {
      // SOS: header, then entropy-coded data until the next real marker.
      i += len;
      for (;;) {
        if (i >= b.length) return null; // truncated entropy data
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        let j = i + 1;
        while (j < b.length && b[j] === 0xff) j++;
        if (j >= b.length) return null;
        const m = b[j]!;
        if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) {
          i = j + 1; // stuffed 0xFF00 or restart marker: still entropy data
          continue;
        }
        i = j - 1; // real marker: resume marker parsing at its 0xFF prefix
        break;
      }
      continue;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (info) return null; // exactly one frame
      if (len < 8) return null;
      const height = (b[i + 3]! << 8) | b[i + 4]!;
      const width = (b[i + 5]! << 8) | b[i + 6]!;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/jpeg', ext: 'jpg', width, height };
    }
    i += len;
  }
  return null; // end of data without EOI
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_DEPTHS: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

// PNG: signature, chunk walk with per-chunk CRC32, IHDR first and exactly
// once, at least one IDAT, IEND last with zero trailing bytes, and the
// concatenated IDAT zlib stream must inflate within the computed bound.
async function validatePng(b: Uint8Array): Promise<ImageInfo | null> {
  if (b.length < 8 || !PNG_SIG.every((v, k) => b[k] === v)) return null;
  let pos = 8;
  let info: ImageInfo | null = null;
  let idatCap = 0;
  let bppBits = 0;
  let interlace = 0;
  let sawIdat = false;
  const idatParts: Uint8Array[] = [];
  let chunks = 0;
  for (;;) {
    if (++chunks > 10000) return null;
    if (pos + 12 > b.length) return null; // truncated chunk
    const len = ((b[pos]! << 24) | (b[pos + 1]! << 16) | (b[pos + 2]! << 8) | b[pos + 3]!) >>> 0;
    if (len > b.length - pos - 12) return null;
    const type = String.fromCharCode(b[pos + 4]!, b[pos + 5]!, b[pos + 6]!, b[pos + 7]!);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    const crc = ((b[pos + 8 + len]! << 24) | (b[pos + 9 + len]! << 16) | (b[pos + 10 + len]! << 8) | b[pos + 11 + len]!) >>> 0;
    if (crc32(b.subarray(pos + 4, pos + 8 + len)) !== crc) return null; // CRC covers type + data
    if (type === 'IHDR') {
      if (info !== null || pos !== 8 || len !== 13) return null; // first chunk, exactly once
      const width = ((b[pos + 8]! << 24) | (b[pos + 9]! << 16) | (b[pos + 10]! << 8) | b[pos + 11]!) >>> 0;
      const height = ((b[pos + 12]! << 24) | (b[pos + 13]! << 16) | (b[pos + 14]! << 8) | b[pos + 15]!) >>> 0;
      const depth = b[pos + 16]!;
      const color = b[pos + 17]!;
      if (b[pos + 18]! !== 0 || b[pos + 19]! !== 0 || b[pos + 20]! > 1) return null; // compression/filter/interlace
      const channels = PNG_CHANNELS[color];
      const depths = PNG_DEPTHS[color];
      if (!channels || !depths?.includes(depth)) return null;
      if (!dimsOk(width, height)) return null;
      // The inflated stream must be EXACTLY the scanlines the header
      // declares (per-pass for Adam7): a byte more is a bomb, a byte less is
      // truncated, and every scanline filter byte is verified at IEND.
      bppBits = channels * depth;
      interlace = b[pos + 20]!;
      idatCap = pngExpectedScanlineBytes(width, height, bppBits, interlace);
      info = { mime: 'image/png', ext: 'png', width, height };
    } else if (type === 'IDAT') {
      if (!info) return null;
      sawIdat = true;
      idatParts.push(b.subarray(pos + 8, pos + 8 + len));
    } else if (type === 'IEND') {
      if (!info || !sawIdat || len !== 0) return null;
      if (pos + 12 !== b.length) return null; // trailing bytes: polyglot
      let total = 0;
      for (const p of idatParts) total += p.length;
      const idat = new Uint8Array(total);
      let off = 0;
      for (const p of idatParts) {
        idat.set(p, off);
        off += p.length;
      }
      const raw = await inflateMax(idat, idatCap);
      return raw !== null && pngScanlinesOk(raw, info.width, info.height, bppBits, interlace) ? info : null;
    }
    pos += 12 + len;
  }
}

// WebP: RIFF size must equal the file size exactly, chunks walk with
// even-byte padding, exactly one still-image stream (VP8/VP8L) or a VP8X
// canvas; animated files (ANIM/ANMF) are not stills and are rejected.
function validateWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 20 || b[0] !== 0x52 || b[1] !== 0x49 || b[2] !== 0x46 || b[3] !== 0x46) return null;
  const riffLen = (b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24)) >>> 0;
  if (riffLen !== b.length - 8) return null; // exact size: no trailing/polyglot
  if (b[8] !== 0x57 || b[9] !== 0x45 || b[10] !== 0x42 || b[11] !== 0x50) return null;
  let pos = 12;
  let info: ImageInfo | null = null;
  let chunks = 0;
  while (pos < b.length) {
    if (++chunks > 1000) return null;
    if (pos + 8 > b.length) return null;
    const fourcc = String.fromCharCode(b[pos]!, b[pos + 1]!, b[pos + 2]!, b[pos + 3]!);
    const size = (b[pos + 4]! | (b[pos + 5]! << 8) | (b[pos + 6]! << 16) | (b[pos + 7]! << 24)) >>> 0;
    if (pos + 8 + size > b.length) return null;
    const d = pos + 8;
    if (fourcc === 'VP8 ') {
      if (info || size < 10) return null;
      if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null; // frame start code
      const width = (b[d + 6]! | (b[d + 7]! << 8)) & 0x3fff;
      const height = (b[d + 8]! | (b[d + 9]! << 8)) & 0x3fff;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'VP8L') {
      if (info || size < 5 || b[d] !== 0x2f) return null; // signature byte
      const bits = (b[d + 1]! | (b[d + 2]! << 8) | (b[d + 3]! << 16) | (b[d + 4]! << 24)) >>> 0;
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'VP8X') {
      if (info || size < 10) return null;
      const width = (b[d + 4]! | (b[d + 5]! << 8) | (b[d + 6]! << 16)) + 1;
      const height = (b[d + 7]! | (b[d + 8]! << 8) | (b[d + 9]! << 16)) + 1;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'ANIM' || fourcc === 'ANMF') {
      return null;
    }
    pos = d + size + (size % 2);
  }
  return info;
}

async function validateImage(b: Uint8Array): Promise<ImageInfo | null> {
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xd8) return validateJpeg(b);
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50) return validatePng(b);
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49) return validateWebp(b);
  return null;
}

async function callRecipesSetImage(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  if (!id) return { status: 400, data: { error: 'id required' } };
  const kind = args['kind'] === undefined ? 'hero' : args['kind'];
  if (kind !== 'hero' && kind !== 'step') return { status: 400, data: { error: "kind must be 'hero' or 'step'" } };
  if (!ctx.images) return { status: 503, data: { error: 'image storage is not configured on this worker' } };
  const recipe = await ctx.db.prepare('SELECT id FROM recipes WHERE id = ?').bind(id).first();
  if (!recipe) return { status: 404, data: { error: 'recipe not found', id } };

  let stepIndex: number | null = null;
  if (kind === 'step') {
    const v = args['stepIndex'] ?? args['step_index'];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 199) {
      return { status: 400, data: { error: 'stepIndex must be an integer 0-199 for step images' } };
    }
    const rows = await ctx.db.prepare('SELECT steps_json FROM recipe_locales WHERE recipe_id = ?').bind(id).all<{ steps_json: string }>();
    const maxSteps = Math.max(
      0,
      ...rows.results.map((r) => {
        try {
          const parsed: unknown = JSON.parse(r.steps_json);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      }),
    );
    if (v >= maxSteps) {
      return { status: 400, data: { error: 'stepIndex out of range for this recipe', stepIndex: v, steps: maxSteps } };
    }
    stepIndex = v;
  }

  const b64 = args['imageBase64'] ?? args['image_base64'];
  if (typeof b64 !== 'string' || b64.length === 0) return { status: 400, data: { error: 'imageBase64 (base64 image bytes) required' } };
  if (b64.length > MAX_IMAGE_BASE64) return { status: 400, data: { error: 'image too large', max_base64_chars: MAX_IMAGE_BASE64 } };
  const bytes = decodeBase64(b64);
  if (!bytes || bytes.length === 0) return { status: 400, data: { error: 'imageBase64 is not valid base64' } };
  if (bytes.length > MAX_IMAGE_BYTES) return { status: 400, data: { error: 'image too large', max_bytes: MAX_IMAGE_BYTES } };
  const info = await validateImage(bytes);
  if (!info) {
    return {
      status: 400,
      data: {
        error:
          'unsupported or unreadable image: a well-formed jpeg/png/webp within 4096px and 16MP is required; the file must parse end-to-end as its type (truncated, malformed, CRC-bad, oversized and trailing-byte polyglot files are rejected); SVG and other unverifiable types are rejected',
      },
    };
  }

  // Rights metadata is mandatory, mirroring the text-source model. The
  // honesty label (style) is part of the record, not decoration.
  const sourceName = str(args['sourceName'] ?? args['source_name'], 200);
  const sourceUrl = str(args['sourceUrl'] ?? args['source_url'], 2000);
  const license = str(args['license'], 100);
  const style = str(args['style'], 20);
  if (!sourceName || !sourceUrl || !(sourceUrl.startsWith('https://') || sourceUrl.startsWith('internal:')) || !license) {
    return { status: 400, data: { error: 'image rights metadata required: sourceName, sourceUrl (https://), license' } };
  }
  if (!style || !IMAGE_STYLES.has(style)) {
    return { status: 400, data: { error: "style must be 'photo', 'illustration' or 'graphic'" } };
  }
  // Provenance metadata records where the image came from; it is NOT
  // clearance. Serving additionally requires this explicit assertion that
  // someone verified the license permits this use. The assertion scopes to
  // this single asset: it clears no other image and not the recipe's text
  // source. The stamp (cleared_at) is what the public route gates on.
  const rightsConfirmed = args['rightsConfirmed'] ?? args['rights_confirmed'];
  if (rightsConfirmed !== true) {
    return {
      status: 400,
      data: {
        error:
          'rightsConfirmed: true required - provenance metadata is not clearance; assert that the license was actually verified to permit serving this image',
      },
    };
  }

  if (ctx.dryRun) {
    return {
      status: 200,
      data: { dry_run: true, ok: true, kind, step_index: stepIndex, mime: info.mime, bytes: bytes.length, width: info.width, height: info.height, style },
    };
  }

  const imageId = newId();
  const r2Key = `recipes/${id}/${imageId}.${info.ext}`;
  // Bytes first, then the row + audit in one batch: a failed write never
  // leaves a served row pointing at missing bytes. A leftover object after a
  // failed batch is unreferenced and never served.
  await ctx.images.put(r2Key, bytes, { httpMetadata: { contentType: info.mime } });
  const stmts = [
    ctx.db
      .prepare(
        'INSERT INTO recipe_images (id, recipe_id, kind, step_index, r2_key, mime, bytes, width, height, style, source_name, source_url, license, cleared_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      )
      .bind(imageId, id, kind, stepIndex, r2Key, info.mime, bytes.length, info.width, info.height, style, sourceName, sourceUrl, license),
    // A new hero becomes the recipe's current hero; older rows stay (nothing
    // is deleted) and the latest hero wins at render.
    ...(kind === 'hero' ? [ctx.db.prepare('UPDATE recipes SET image_key = ? WHERE id = ?').bind(r2Key, id)] : []),
    auditStmt(ctx, 'recipes.set_image', imageId, { recipe_id: id, kind, step_index: stepIndex, bytes: bytes.length, style }),
  ];
  try {
    await ctx.db.batch(stmts);
  } catch {
    return { status: 500, data: { error: 'image write failed after upload; the bytes are unreferenced and nothing was recorded - safe to retry' } };
  }
  return {
    status: 201,
    data: {
      image_id: imageId,
      recipe_id: id,
      kind,
      step_index: stepIndex,
      r2_key: r2Key,
      mime: info.mime,
      bytes: bytes.length,
      width: info.width,
      height: info.height,
      style,
      url_path: `/img/recipe/${imageId}`,
      note: 'served publicly only while rights-cleared (cleared_at) and the recipe has a published, rights-cleared locale; edge/browser caches may keep it up to 5 minutes after unpublish',
    },
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

/** Frozen-map guard (migration 0005): a slug that ever served publicly stays
 * reserved for that recipe permanently - never updated, never deleted, and
 * never claimable by another recipe. Returns the reserving recipe id when a
 * different recipe holds it, else null. */
async function slugReservedByOther(ctx: CallCtx, country: string, lang: string, slug: string, recipeId: string): Promise<string | null> {
  const row = await ctx.db
    .prepare('SELECT recipe_id FROM recipe_slug_aliases WHERE country = ? AND lang = ? AND slug = ?')
    .bind(country, lang, slug)
    .first<{ recipe_id: string }>();
  return row && row.recipe_id !== recipeId ? row.recipe_id : null;
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

type CallCtx = { db: D1Database; role: Role; actor: string; declaredCaller?: string | null; dryRun?: boolean; translationReviewEnabled?: boolean; images?: R2Bucket };
type CallResult = { status: number; data: unknown };


// --- Private user drafts ------------------------------------------------------
// Recipes created through public accounts (recipes.owner_user_id) are private
// until an admin publishes them. Non-admin keys (viewer/editor) never see them.
// Admin sees only SUBMITTED ones (the review queue), never unsubmitted drafts.
// Same rule everywhere: a recipe is private when it has an owner, none of its
// locales is published, and (role is not admin OR it was not submitted).
function privateRecipeSql(alias: string, role: Role): string {
  return `(${alias}.owner_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_locales pq WHERE pq.recipe_id = ${alias}.id AND pq.status = 'published') AND (${role === 'admin' ? '0' : '1'} = 1 OR ${alias}.submitted_at IS NULL))`;
}

const RECIPE_ID_TOOLS = new Set(['recipes.get', 'recipes.update_draft', 'recipes.add_locale', 'translations.mark_reviewed', 'recipes.publish', 'recipes.unpublish', 'recipes.set_image']);
const SOURCE_ID_TOOLS = new Set(['sources.update', 'sources.clear_rights']);

/** True when the call targets a private user recipe/source the caller may not touch. Answered as plain not-found. */
async function targetsPrivateUserDraft(ctx: CallCtx, name: string, args: Record<string, unknown>): Promise<boolean> {
  const id = str(args['id'], 64);
  if (!id) return false;
  if (RECIPE_ID_TOOLS.has(name)) {
    const row = await ctx.db.prepare(`SELECT 1 AS x FROM recipes r WHERE r.id = ? AND ${privateRecipeSql('r', ctx.role)}`).bind(id).first();
    return !!row;
  }
  if (SOURCE_ID_TOOLS.has(name)) {
    const row = await ctx.db.prepare(`SELECT 1 AS x FROM recipes r WHERE r.source_id = ? AND ${privateRecipeSql('r', ctx.role)} LIMIT 1`).bind(id).first();
    return !!row;
  }
  return false;
}

async function callRecipesList(db: D1Database, role: Role, args: Record<string, unknown>): Promise<CallResult> {
  const conds: string[] = [];
  const params: unknown[] = [];
  for (const col of ['country', 'lang', 'status'] as const) {
    const v = args[col];
    if (typeof v === 'string' && v) {
      conds.push(`rl.${col} = ?`);
      params.push(v);
    }
  }
  if (args['submitted'] === true) conds.push('r.submitted_at IS NOT NULL');
  conds.push(`NOT ${privateRecipeSql('r', role)}`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db
    .prepare(
      `SELECT rl.recipe_id AS id, rl.country, rl.lang, rl.slug, rl.title, rl.status,
              r.submitted_at, r.attested_at, r.owner_user_id IS NOT NULL AS user_submitted,
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
  delete (recipe as Record<string, unknown>)['owner_user_id']; // account identity never leaves the account tables
  const locales = await db.prepare('SELECT * FROM recipe_locales WHERE recipe_id = ?').bind(id).all();
  const source = await db
    .prepare('SELECT * FROM sources WHERE id = ?')
    .bind((recipe as Record<string, unknown>)['source_id'] as string)
    .first();
  const images = await db
    .prepare(
      'SELECT id, kind, step_index, mime, bytes, width, height, style, source_name, source_url, license, created_at FROM recipe_images WHERE recipe_id = ? ORDER BY created_at',
    )
    .bind(id)
    .all();
  return { status: 200, data: { recipe, locales: locales.results, source, images: images.results } };
}

async function callSourcesList(db: D1Database, role: Role): Promise<CallResult> {
  const rows = await db
    .prepare(`SELECT id, name, url, license, cleared_at, notes FROM sources s WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.source_id = s.id AND ${privateRecipeSql('r', role)}) ORDER BY id`)
    .all();
  return { status: 200, data: { sources: rows.results } };
}

async function callSearchGapLogs(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const limit = Math.min(Math.max(Number(args['limit'] || 50), 1), 100);
  const rows = await db
    .prepare('SELECT id, query, locale, created_at FROM search_gap_logs ORDER BY id DESC LIMIT ?')
    .bind(limit)
    .all();
  return { status: 200, data: { logs: rows.results } };
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
  const times = parseTimeFields(args);
  if (!times.ok) return { status: 400, data: { error: times.error } };
  const category = parseCategoryField(args);
  if (!category.ok) return { status: 400, data: { error: category.error } };
  const finalCategory = category.present && category.value ? category.value : 'mains';
  // Canonicalize structured ingredients for storage and verify step tokens.
  const storedIngredients: IngredientEntry[][] = [];
  for (const l of sub.locales) {
    const canon = canonicalizeIngredients(l.ingredients);
    if (!canon.ok) return { status: 400, data: { error: canon.error } };
    const tokenErr = validateStepTokens(l.steps, canon.entries);
    if (tokenErr) return { status: 400, data: { error: tokenErr } };
    storedIngredients.push(canon.entries);
  }
  // Frozen-map reservation (migration 0005): a slug that served publicly for
  // another recipe can never be claimed again. Runs before the dry-run return
  // so a dry run reports the same 409 the confirmed call would. A new draft
  // has no id yet, so every alias row found belongs to another recipe.
  for (const l of sub.locales) {
    const claimSlug = l.slug ?? slugify(l.title);
    const holder = await slugReservedByOther(ctx, l.country, l.lang, claimSlug, '');
    if (holder) {
      return {
        status: 409,
        data: { error: 'slug is reserved by an earlier public URL of another recipe', country: l.country, lang: l.lang, slug: claimSlug },
      };
    }
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
      .prepare(
        'INSERT INTO recipes (id, source_id, origin_country, image_key, created_at, prep_minutes, cook_minutes, rest_minutes, total_minutes, base_servings, category) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        sourceId,
        sub.originCountry ?? null,
        now,
        times.values.prepMinutes ?? null,
        times.values.cookMinutes ?? null,
        times.values.restMinutes ?? null,
        times.values.totalMinutes ?? null,
        times.values.baseServings ?? null,
        finalCategory,
      ),
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
            .prepare(`SELECT rl.recipe_id FROM recipe_locales rl JOIN recipes r ON r.id = rl.recipe_id WHERE rl.country = ? AND rl.lang = ? AND rl.slug = ? AND NOT ${privateRecipeSql('r', ctx.role)}`)
            .bind(first.country, first.lang, first.slug ?? slugify(first.title))
            .first<{ recipe_id: string }>()
        : null;
      return { status: 409, data: { error: 'a locale with this country/lang/slug already exists', existing_id: existing?.recipe_id ?? null } };
    }
    throw e;
  }
  return {
    status: 201,
    data: {
      id,
      source_id: sourceId,
      status: 'draft',
      locales: sub.locales.length,
      ...(times.warnings.length ? { warnings: times.warnings } : {}),
    },
  };
}

async function callRecipesUpdateDraft(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const locales = args['locales'];
  if (!id) return { status: 400, data: { error: 'id required' } };
  // Fail loudly on an unknown recipe so a mistyped backfill id can never
  // report success on a no-op write.
  const recipeExists = await ctx.db.prepare('SELECT id FROM recipes WHERE id = ?').bind(id).first();
  if (!recipeExists) return { status: 404, data: { error: 'recipe not found', id } };
  const hasLocaleUpdates = Array.isArray(locales) && locales.length > 0;
  if (!hasLocaleUpdates) {
    // A call without locale edits is valid only when it carries recipe-level
    // fields (times/servings/category), which update independently of locale
    // draft state.
    const timesProbe = parseTimeFields(args);
    const catProbe = parseCategoryField(args);
    const hasRecipeFields =
      (timesProbe.ok && Object.keys(timesProbe.values).length > 0) || (catProbe.ok && catProbe.present);
    if (!hasRecipeFields) {
      return { status: 400, data: { error: 'id and a non-empty locales array or recipe-level fields (times, baseServings, category) required' } };
    }
  }
  if (Array.isArray(locales) && locales.length > MAX_LOCALES) return { status: 400, data: { error: `at most ${MAX_LOCALES} locales per call` } };
  const existingRows = await ctx.db
    .prepare('SELECT country, lang, status, ingredients_json, steps_json, translation_of FROM recipe_locales WHERE recipe_id = ?')
    .bind(id)
    .all<{ country: string; lang: string; status: string; ingredients_json: string; steps_json: string; translation_of: string | null }>();
  // Pass 1: validate every locale before any write; a multi-locale call never
  // applies partially.
  type Planned = { key: string; stmt: D1PreparedStatement };
  const planned: Planned[] = [];
  for (const entry of (hasLocaleUpdates ? (locales as unknown[]) : [])) {
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
  // Top-level structured timing/yield fields (migration 0004) live on the
  // recipe, not the locale: translation-invariant, edited independently of
  // locale draft state. A field set to null clears it.
  const times = parseTimeFields(args);
  if (!times.ok) return { status: 400, data: { error: times.error } };
  const category = parseCategoryField(args);
  if (!category.ok) return { status: 400, data: { error: category.error } };
  const finalCategory = category.present && category.value ? category.value : 'mains';
  const timeSets: string[] = [];
  const timeParams: unknown[] = [];
  const TIME_COLS: Record<string, string> = {
    prepMinutes: 'prep_minutes',
    cookMinutes: 'cook_minutes',
    restMinutes: 'rest_minutes',
    totalMinutes: 'total_minutes',
    baseServings: 'base_servings',
  };
  for (const [field, col] of Object.entries(TIME_COLS)) {
    if (field in times.values) {
      timeSets.push(`${col} = ?`);
      timeParams.push(times.values[field as keyof typeof times.values] ?? null);
    }
  }
  if (category.present) {
    timeSets.push('category = ?');
    timeParams.push(category.value);
  }
  const recipeFields = [...Object.keys(times.values), ...(category.present ? ['category'] : [])];
  const updated = planned.map((pl) => pl.key);
  if (ctx.dryRun) {
    return {
      status: 200,
      data: { dry_run: true, ok: true, id, updated, recipe_fields: recipeFields, ...(times.warnings.length ? { warnings: times.warnings } : {}) },
    };
  }
  const stmts = [...planned.map((pl) => pl.stmt)];
  if (timeSets.length) {
    stmts.push(ctx.db.prepare(`UPDATE recipes SET ${timeSets.join(', ')} WHERE id = ?`).bind(...timeParams, id));
  }
  if (stmts.length) {
    // Content mutation and audit row commit in one atomic batch.
    await ctx.db.batch([...stmts, auditStmt(ctx, 'recipes.update_draft', id, { updated, recipe_fields: recipeFields })]);
  }
  return {
    status: 200,
    data: { id, updated, recipe_fields: recipeFields, ...(times.warnings.length ? { warnings: times.warnings } : {}) },
  };
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
  // Frozen-map reservation (migration 0005), same rule as create_draft.
  // Checked before the dry-run return so a dry run reports the same 409.
  const aliasHolder = await slugReservedByOther(ctx, country, lang, slug, id);
  if (aliasHolder) {
    return {
      status: 409,
      data: { error: 'slug is reserved by an earlier public URL of another recipe', country, lang, slug },
    };
  }
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
  const statements = [];
  if (kind === 'recipe' && target === 'draft') {
    // Frozen map (migration 0005): slugs leaving the sitemap are reserved
    // permanently so their old URLs keep resolving and can never be claimed
    // by another recipe. Runs before the status update inside the same
    // atomic batch so it reads the pre-update published slugs.
    statements.push(
      ctx.db
        .prepare(
          `INSERT OR IGNORE INTO recipe_slug_aliases (country, lang, slug, recipe_id) SELECT country, lang, slug, recipe_id FROM recipe_locales WHERE recipe_id = ? AND status = '${from}'${scope}`,
        )
        .bind(...countBind),
    );
  }
  // Content mutation and audit row commit in one atomic batch.
  statements.push(
    ctx.db.prepare(`UPDATE ${table} SET status = ? WHERE ${fk} = ? AND status = '${from}'${scope}`).bind(...bind),
    auditStmt(ctx, tool, id, {
      locales_changed: matchedCount,
      ...(country ? { country, lang } : {}),
      ...(kind === 'blog' && target === 'published' ? { review: args['review'] } : {}),
    }),
  );
  await ctx.db.batch(statements);
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
  // Every write commits content + audit in one D1 batch, so an in-process
  // failure means nothing was written. This guarantee covers the D1 failure
  // only: a client that saw a transport timeout cannot tell committed from
  // uncommitted and must re-check state (recipes.get/list) before retrying.
  try {
    if (await targetsPrivateUserDraft(ctx, name, args)) return { status: 404, data: { error: 'not found' } };
    return await dispatch(ctx, name, args);
  } catch {
    return {
      status: 500,
      data: {
        error: 'write failed before commit; content and audit are atomic, so nothing was written and this call is safe to retry',
        hint: 'if the request failed at the transport level (timeout, no response), re-check state with recipes.get/list before retrying - the write may have committed',
      },
    };
  }
}

// --- Community kitchen-test reports (migration 0008) ---------------------------
// Reports are a queue only: nothing a cook submits changes the site until an
// admin approves here. Approval stamps tested_at/tested_by; rejection hides.

async function callListTestReports(db: D1Database, args: Record<string, unknown>): Promise<CallResult> {
  const status = str(args['status'], 16) || 'pending';
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return { status: 400, data: { error: 'status must be pending, approved or rejected' } };
  }
  const rows = await db
    .prepare(
      `SELECT tr.id, tr.recipe_id, tr.note, tr.status, tr.created_at, tr.moderated_at, tr.moderated_by,
              u.display_name AS cook_name, MIN(l.title) AS recipe_title
       FROM recipe_test_reports tr
       JOIN users u ON u.id = tr.user_id
       LEFT JOIN recipe_locales l ON l.recipe_id = tr.recipe_id AND l.status = 'published'
       WHERE tr.status = ?
       GROUP BY tr.id
       ORDER BY tr.created_at ASC LIMIT 200`,
    )
    .bind(status)
    .all();
  return { status: 200, data: { reports: rows.results } };
}

async function callModerateTestReport(ctx: CallCtx, args: Record<string, unknown>): Promise<CallResult> {
  const id = str(args['id'], 64);
  const decision = str(args['decision'], 16);
  if (!id || (decision !== 'approve' && decision !== 'reject')) {
    return { status: 400, data: { error: 'id and decision (approve|reject) are required' } };
  }
  if (ctx.dryRun) {
    const row = await ctx.db.prepare("SELECT 1 AS x FROM recipe_test_reports WHERE id = ? AND status = 'pending'").bind(id).first();
    return row
      ? { status: 200, data: { dry_run: true, ok: true, id, decision } }
      : { status: 409, data: { error: 'report not found or already moderated', id } };
  }
  const now = new Date().toISOString();
  if (decision === 'approve') {
    // Status flip and recipe stamp commit in one batch: a failure writes
    // nothing, so the call is safe to retry.
    const res = await ctx.db.batch([
      ctx.db.prepare("UPDATE recipe_test_reports SET status = 'approved', moderated_at = ?, moderated_by = ? WHERE id = ? AND status = 'pending'").bind(now, ctx.actor, id),
      // The first approved report stamps the recipe; later approvals corroborate only.
      // The stamp re-reads the report's status inside the same transaction, so an
      // approve on a report the flip did not move (already rejected/approved)
      // cannot mark the recipe tested.
      ctx.db.prepare(
        `UPDATE recipes SET
           tested_at = (SELECT tr.created_at FROM recipe_test_reports tr WHERE tr.id = ?),
           tested_by = (SELECT COALESCE(u.display_name, 'A 2yolks cook') FROM recipe_test_reports tr JOIN users u ON u.id = tr.user_id WHERE tr.id = ?)
         WHERE id = (SELECT tr.recipe_id FROM recipe_test_reports tr WHERE tr.id = ?) AND tested_at IS NULL
           AND (SELECT tr.status FROM recipe_test_reports tr WHERE tr.id = ?) = 'approved'`,
      ).bind(id, id, id, id),
      auditStmt(ctx, 'recipes.moderate_test_report', id, { decision: 'approve' }),
    ]);
    if (res[0]!.meta.changes !== 1) return { status: 409, data: { error: 'report not found or already moderated', id } };
    return { status: 200, data: { id, status: 'approved' } };
  }
  const res = await ctx.db.batch([
    ctx.db.prepare("UPDATE recipe_test_reports SET status = 'rejected', moderated_at = ?, moderated_by = ? WHERE id = ? AND status = 'pending'").bind(now, ctx.actor, id),
    auditStmt(ctx, 'recipes.moderate_test_report', id, { decision: 'reject' }),
  ]);
  if (res[0]!.meta.changes !== 1) return { status: 409, data: { error: 'report not found or already moderated', id } };
  return { status: 200, data: { id, status: 'rejected' } };
}

async function dispatch(ctx: CallCtx, name: string, args: Record<string, unknown>): Promise<CallResult> {
  switch (name) {
    case 'recipes.list':
      return callRecipesList(ctx.db, ctx.role, args);
    case 'recipes.get':
      return callRecipesGet(ctx.db, args);
    case 'sources.list':
      return callSourcesList(ctx.db, ctx.role);
    case 'search.gap_logs':
      return callSearchGapLogs(ctx.db, args);
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
    case 'recipes.list_test_reports':
      return callListTestReports(ctx.db, args);
    case 'recipes.moderate_test_report':
      return callModerateTestReport(ctx, args);
    case 'sources.update':
      return callSourcesUpdate(ctx, args);
    case 'sources.clear_rights':
      return callSourcesClearRights(ctx, args);
    case 'recipes.set_image':
      return callRecipesSetImage(ctx, args);
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
    images: c.env.IMAGES,
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
