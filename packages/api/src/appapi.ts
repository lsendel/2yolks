// JSON API for the native 2yolks app (iOS). Additive sibling of the HTML
// account module: same auth_codes, sessions, mail budgets, rate limits and
// submission pipeline, and the same published() serving gate. No cookies and
// no CORS headers: the app authenticates with the bearer token returned by
// /auth/verify, so there is no ambient authority and no Origin/CSRF check.
// Publication is NOT possible here either: submitting only flags a draft for
// review; an admin publishes through the MCP after rights clearance.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eq, and, ne, desc, isNotNull } from 'drizzle-orm';
import { LOCALES, getCountry, validateRecipeSubmission, slugify, isStructured } from '@2yolks/contracts';
import type { StructuredIngredient } from '@2yolks/contracts';
import { createDb, recipes, recipeLocales, recipeImages, sources, published } from './db';
import { sendMail } from './email';
import {
  type AccountBindings, type FormState,
  sha256Hex, randomCode, randomToken, newId, normEmail, str,
  reserveMail, cleanupExpired, limited, parseForm, buildSubmission, loadOwned,
  SESSION_DAYS, MAX_ATTEMPTS, CODES_PER_EMAIL_10MIN, CODES_PER_DAY, NOTICES_PER_DAY,
  MAX_DRAFTS_PER_USER, MAX_ROWS_PER_USER,
} from './account';

type User = { id: string; email: string; displayName: string | null };
type Env = { Bindings: AccountBindings; Variables: { user: User } };
export const appApi = new Hono<Env>();
type Ctx = Context<Env>;

// Ingredient rows are lossless: IngredientEntry = string | StructuredIngredient
// ({ref, qty, qtyEnd?, unit?, name, note?}). Structured rows carry the unit and
// ref contract the app needs for scaling/unit conversion; steps keep their raw
// text including {i:ref} references so the app can link them to ingredients.
export type IngredientDTO = string | StructuredIngredient;
const parseIngredientEntries = (json: string): IngredientDTO[] => {
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is IngredientDTO => typeof x === 'string' || isStructured(x));
  } catch { return []; }
};
const parseStepLines = (json: string): string[] => {
  try { const v: unknown = JSON.parse(json); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
};

const NO_STORE = { 'cache-control': 'no-store' } as const;
const err = (c: Ctx, status: 400 | 401 | 403 | 404 | 409 | 415 | 429 | 503, message: string) =>
  c.json({ error: message }, status, NO_STORE);
const errors = (c: Ctx, list: string[]) => c.json({ errors: list }, 400, NO_STORE);

// Native-safe CSRF/budget guard for every mutating route (mirrors the HTML
// module's Origin check without its cookie assumption): browsers can only send
// application/json cross-site via CORS preflight, which this API never
// answers, and a foreign Origin header is rejected outright. An ABSENT Origin
// is the native app. This keeps a cross-site text/plain form post from
// burning the daily mail budget through /auth/code.
const mutationGuard = async (c: Ctx, next: () => Promise<void>) => {
  if (c.req.method !== 'GET') {
    // Only requests that actually carry a body must send it as JSON; bodyless
    // POST/DELETE (logout, submit, remove, account deletion) need no content-type.
    const ct = c.req.header('content-type');
    const hasBody = ct !== undefined || (c.req.header('content-length') ?? '0') !== '0' || c.req.header('transfer-encoding') !== undefined;
    if (hasBody && !(ct ?? '').startsWith('application/json')) return err(c, 415, 'Send application/json.');
    const origin = c.req.header('origin');
    if (origin !== undefined) {
      const allowed = new Set([new URL(c.req.url).origin]);
      if (c.env.CANONICAL_ORIGIN) allowed.add(c.env.CANONICAL_ORIGIN);
      if (!allowed.has(origin)) return err(c, 403, 'This request did not come from 2yolks, so it was blocked.');
    }
  }
  await next();
};
appApi.use('/auth/*', mutationGuard);
appApi.use('/me', mutationGuard);
appApi.use('/me/*', mutationGuard);

appApi.use('*', bodyLimit({
  maxSize: 256 * 1024,
  onError: (c) => c.json({ error: 'That request is too large.' }, 413, NO_STORE),
}));

// Bearer-token session lookup: same sessions table and hash-at-rest rule as
// the cookie flow (the raw token only ever lives in the app keychain).
async function bearerUser(c: Ctx): Promise<User | null> {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(c.req.header('authorization') ?? '');
  if (!m) return null;
  const id = await sha256Hex(m[1]!);
  const row = await c.env.DB.prepare(
    'SELECT u.id AS id, u.email AS email, u.display_name AS displayName FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
  ).bind(id, Date.now()).first<User>();
  return row ?? null;
}

appApi.use('*', async (c, next) => {
  const u = await bearerUser(c);
  if (u) c.set('user', u);
  await next();
});

const requireUser = async (c: Ctx, next: () => Promise<void>) => {
  if (!c.get('user')) return err(c, 401, 'Sign in first.');
  await next();
};
appApi.use('/me', requireUser);
appApi.use('/me/*', requireUser);
appApi.use('/auth/logout', requireUser);

// --- Auth (JSON mirror of /account/code + /account/verify) -------------------

appApi.post('/auth/code', async (c) => {
  if (await limited(c.env.RL_AUTH, c, 'code')) return err(c, 429, 'Too many tries. Please wait a minute.');
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const email = normEmail(body?.['email']);
  if (!email) return err(c, 400, 'Enter a valid email address.');
  if (!c.env.RESEND_API_KEY) return err(c, 503, 'Sign-in email is not switched on yet.');
  const now = Date.now();
  await cleanupExpired(c.env.DB, now);
  const code = randomCode();
  const id = newId();
  // Per-email budget first (atomic INSERT ... SELECT ... WHERE count<3) so rejected retries never spend site budget.
  const ins = await c.env.DB.prepare(
    'INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,used,created_at) SELECT ?,?,?,?,0,0,? WHERE (SELECT count(*) FROM auth_codes WHERE email = ? AND created_at > ?) < ?',
  ).bind(id, email, await sha256Hex(`${email}:${code}`), now + 10 * 60_000, now, email, now - 10 * 60_000, CODES_PER_EMAIL_10MIN).run();
  if (ins.meta.changes !== 1) return err(c, 429, 'Too many codes requested for this email. Try again in a few minutes.');
  // Then the site-wide daily mail budget (atomic conditional INSERT). No budget: the code is never sent, so kill it.
  if (!(await reserveMail(c.env.DB, 'code', CODES_PER_DAY))) {
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return err(c, 503, 'Sign-in is busy right now. Please try again tomorrow.');
  }
  // Only the newest code stays valid. Order by insertion (rowid), so a concurrently issued newer code is never invalidated by an older request.
  await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE email = ? AND used = 0 AND rowid < (SELECT rowid FROM auth_codes WHERE id = ?)').bind(email, id).run();
  const sent = await sendMail(c.env, { to: email, subject: `Your 2yolks code: ${code}`, text: `Your 2yolks sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.\n` });
  if (!sent) {
    // No refund: delivery state is ambiguous, so the budget slot and per-email slot stay used. Invalidate the code.
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return err(c, 503, 'We could not send the email. Please try again later.');
  }
  return c.json({ ok: true }, 200, NO_STORE);
});

appApi.post('/auth/verify', async (c) => {
  if (await limited(c.env.RL_AUTH, c, 'verify')) return err(c, 429, 'Too many tries. Please wait a minute.');
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const email = normEmail(body?.['email']);
  const code = str(body?.['code'], 12).trim();
  if (!email || !/^\d{6}$/.test(code)) return err(c, 400, 'Enter the 6-digit code.');
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT id, code_hash AS hash FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > ? AND attempts < ? ORDER BY rowid DESC LIMIT 1')
    .bind(email, now, MAX_ATTEMPTS).first<{ id: string; hash: string }>();
  if (!row) return err(c, 400, 'That code expired or was used up. Request a new one.');
  // Claim one attempt atomically; concurrent guesses cannot exceed the cap.
  const claim = await c.env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ? AND used = 0 AND attempts < ? AND expires_at > ?').bind(row.id, MAX_ATTEMPTS, now).run();
  if (claim.meta.changes !== 1) return err(c, 400, 'That code expired or was used up. Request a new one.');
  const given = await sha256Hex(`${email}:${code}`);
  let diff = given.length ^ row.hash.length;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ (row.hash.charCodeAt(i) || 0);
  if (diff !== 0) return err(c, 400, 'That code is not right.');
  // Single-use: exactly one concurrent correct submission can flip used 0 -> 1.
  const use = await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ? AND used = 0').bind(row.id).run();
  if (use.meta.changes !== 1) return err(c, 400, 'That code was already used. Request a new one.');
  let user = await c.env.DB.prepare('SELECT id, display_name AS displayName FROM users WHERE email = ?').bind(email).first<{ id: string; displayName: string | null }>();
  if (!user) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (id,email,display_name,created_at) VALUES (?,?,NULL,?)').bind(newId(), email, new Date().toISOString()).run();
    user = await c.env.DB.prepare('SELECT id, display_name AS displayName FROM users WHERE email = ?').bind(email).first<{ id: string; displayName: string | null }>();
    if (!user) return err(c, 503, 'Something went wrong. Please try again.');
  }
  const token = randomToken();
  const expiresAt = now + SESSION_DAYS * 86_400_000;
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), user.id, expiresAt, now).run();
  return c.json({ token, expiresAt, user: { id: user.id, email, displayName: user.displayName } }, 200, NO_STORE);
});

appApi.post('/auth/logout', async (c) => {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(c.req.header('authorization') ?? '');
  if (m) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(m[1]!)).run();
  return c.json({ ok: true }, 200, NO_STORE);
});

// --- Profile + account deletion ----------------------------------------------

appApi.get('/me', (c) => {
  const u = c.get('user')!;
  return c.json({ user: u }, 200, NO_STORE);
});

// Deletes the account. Grounded in the privacy page ("we store your email
// address, the author name you choose, and the recipe drafts you save") and
// in the MCP privacy rule (mcp.ts privateRecipeSql): a user recipe is PRIVATE
// only while owner_user_id IS NOT NULL, so the owner link must never be
// nulled on retained non-published rows.
//  - Never-submitted drafts: deleted outright (rows, locales, images,
//    per-submission source). They never left the owner's private space.
//  - Submitted-not-published: withdrawn ('rejected') but KEPT with
//    author_name, source, submitted_at and attested_at intact - the review/
//    consent audit trail (consent evidence is never destroyed).
//  - Published: stays live under its per-recipe author credit, attestation
//    intact (license provenance).
//  - Identity: sessions and auth codes are deleted and the users row is
//    anonymized to a tombstone (email/display_name gone), which keeps
//    owner_user_id valid so retained private content stays private in MCP.
appApi.delete('/me/account', async (c) => {
  const user = c.get('user')!;
  await c.env.DB.batch([
    // 1. Never-submitted, never-published drafts: delete content + per-submission source rows.
    //    (Anything with a published locale is never deleted, even if submitted_at is NULL.)
    c.env.DB.prepare("DELETE FROM recipe_images WHERE recipe_id IN (SELECT id FROM recipes r WHERE r.owner_user_id = ? AND r.submitted_at IS NULL AND NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = r.id AND l.status = 'published'))").bind(user.id),
    c.env.DB.prepare("DELETE FROM recipe_locales WHERE recipe_id IN (SELECT id FROM recipes r WHERE r.owner_user_id = ? AND r.submitted_at IS NULL AND NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = r.id AND l.status = 'published'))").bind(user.id),
    c.env.DB.prepare("DELETE FROM recipes WHERE owner_user_id = ? AND submitted_at IS NULL AND NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = recipes.id AND l.status = 'published')").bind(user.id),
    c.env.DB.prepare("DELETE FROM sources WHERE id LIKE 'src-%' AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.source_id = sources.id) AND notes = 'user submission - rights review pending'").bind(),
    // 2. Submitted but not yet published: withdraw from the queue, keep the evidence.
    c.env.DB.prepare("UPDATE recipe_locales SET status = 'rejected' WHERE status = 'draft' AND recipe_id IN (SELECT id FROM recipes WHERE owner_user_id = ? AND submitted_at IS NOT NULL)").bind(user.id),
    // 3. Sign-in artifacts gone; identity anonymized to a tombstone so the
    //    owner link (and with it the MCP private-draft classification) survives.
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM auth_codes WHERE email = ?').bind(user.email),
    c.env.DB.prepare("UPDATE users SET email = ?, display_name = NULL WHERE id = ?").bind(`deleted-${user.id}@account-deleted.invalid`, user.id),
  ]);
  return c.json({ ok: true }, 200, NO_STORE);
});

// --- Own recipes (JSON mirror of the account home list + save/submit/remove) -

appApi.get('/me/recipes', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const rows = await db.select({
    id: recipes.id, submittedAt: recipes.submittedAt, createdAt: recipes.createdAt,
    title: recipeLocales.title, status: recipeLocales.status,
    country: recipeLocales.country, lang: recipeLocales.lang, slug: recipeLocales.slug,
  })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id))
    .where(and(eq(recipes.ownerUserId, user.id), ne(recipeLocales.status, 'rejected'))).orderBy(desc(recipes.createdAt));
  return c.json({
    recipes: rows.map((r) => ({
      ...r,
      state: r.status === 'published' ? 'published' : r.submittedAt ? 'submitted' : 'draft',
    })),
  }, 200, NO_STORE);
});

// Full owned-recipe detail for edit rehydration (relaunch-and-continue-editing).
// Read-only view: the app decides editability from `state` (draft only).
appApi.get('/me/recipes/:id', async (c) => {
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return err(c, 404, 'Draft not found.');
  const { r, l, s } = row;
  const user = c.get('user')!;
  const adapted = s.license === 'user-adapted';
  return c.json({
    id: r.id,
    title: l.title,
    intro: l.intro,
    ingredients: parseIngredientEntries(l.ingredientsJson),
    steps: parseStepLines(l.stepsJson),
    locale: `${l.country}:${l.lang}`,
    slug: l.slug,
    status: l.status,
    state: l.status === 'published' ? 'published' : r.submittedAt ? 'submitted' : 'draft',
    submittedAt: r.submittedAt,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    baseServings: r.baseServings,
    displayName: r.authorName ?? user.displayName,
    sourceKind: adapted ? 'adapted' : 'original',
    // An original recipe's source url is just the site origin placeholder, not user data.
    sourceUrl: adapted ? s.url : '',
    attest: r.attestedAt !== null,
  }, 200, NO_STORE);
});

// Accepts the same fields as the HTML draft form. ingredients/steps may be
// arrays of lines or newline-joined text; times/servings may be numbers.
const saveDraft = async (c: Ctx) => {
  const user = c.get('user')!;
  if (await limited(c.env.RL_SUBMIT, c, 'save')) return err(c, 429, 'Too many saves. Please wait a minute.');
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return err(c, 400, 'Send a JSON body.');
  const asText = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 500)).join('\n') : v);
  const asNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : v);
  const form: Record<string, unknown> = {
    title: body['title'], intro: body['intro'],
    ingredients: asText(body['ingredients']), steps: asText(body['steps']),
    locale: body['locale'],
    prep: asNum(body['prepMinutes'] ?? body['prep']),
    cook: asNum(body['cookMinutes'] ?? body['cook']),
    servings: asNum(body['baseServings'] ?? body['servings']),
    display_name: body['displayName'] ?? body['display_name'],
    source_kind: body['sourceKind'] ?? body['source_kind'],
    source_url: body['sourceUrl'] ?? body['source_url'] ?? '',
    attest: body['attest'] === true || body['attest'] === '1' ? '1' : '',
  };
  const isUpdate = c.req.method === 'PUT';
  if (isUpdate) form['id'] = c.req.param('id');
  const s = parseForm(form, user);
  const problems: string[] = [];
  if (!s.displayName) problems.push('Add the name to show as author.');
  if (s.sourceKind === 'adapted' && !/^https:\/\//.test(s.sourceUrl)) problems.push('Adapted recipes need an https:// link to the original.');
  const [country, lang] = s.locale.split(':');
  if (!country || !lang || !(LOCALES[country] ?? []).includes(lang) || !getCountry(country)) problems.push('Pick a language from the list.');
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const result = problems.length ? null : validateRecipeSubmission(buildSubmission(s, origin));
  if (result && !result.ok) for (const f of result.errors) problems.push(`${f.path ? f.path.replace(/^locales\[0\]\./, '') + ': ' : ''}${f.message}`);
  if (problems.length || !result || !result.ok) return errors(c, problems);

  const sub = result.value;
  const loc = sub.locales[0]!;
  const D = c.env.DB;
  let id = s.id;
  if (isUpdate) {
    const owned = await loadOwned(c, id!);
    if (!owned) return err(c, 404, 'Draft not found.');
    if (owned.r.submittedAt || owned.l.status === 'published') return err(c, 409, 'This recipe was already sent in for review.');
  } else {
    id = newId();
  }
  // Unique suffix is reserved first; the readable part is truncated, never the id. Titles that cannot slugify fall back to 'recipe'.
  const base = (() => { try { return slugify(loc.title).slice(0, 100).replace(/-+$/, ''); } catch { return ''; } })() || 'recipe';
  const slug = `${base}-${id}`;
  const now = new Date().toISOString();
  const x = sub as unknown as Record<string, number | undefined>;
  const prep = x['prepMinutes'] ?? null, cook = x['cookMinutes'] ?? null, serv = x['baseServings'] ?? null;
  const ing = JSON.stringify(loc.ingredients), stp = JSON.stringify(loc.steps);
  if (isUpdate) {
    // One transaction (D1 batch). Every statement re-checks "owned, not submitted, not published"
    // so a concurrent submit cannot be overwritten; nothing is deleted, rows are updated in place.
    const open = "EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM recipe_locales q WHERE q.recipe_id = ? AND q.status = 'published')";
    const guard = [id, user.id, id];
    const res = await D.batch([
      D.prepare(`UPDATE sources SET name = ?, url = ?, license = ? WHERE id = (SELECT source_id FROM recipes WHERE id = ?) AND ${open}`).bind(sub.source.name, sub.source.url, sub.source.license, id, ...guard),
      D.prepare(`UPDATE recipe_locales SET country = ?, lang = ?, title = ?, slug = ?, intro = ?, ingredients_json = ?, steps_json = ? WHERE recipe_id = ? AND ${open}`).bind(loc.country, loc.lang, loc.title, slug, loc.intro ?? null, ing, stp, id, ...guard),
      D.prepare(`UPDATE recipes SET origin_country = ?, prep_minutes = ?, cook_minutes = ?, base_servings = ?, attested_at = ?, author_name = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL`).bind(sub.originCountry ?? null, prep, cook, serv, s.attest ? now : null, s.displayName, id, user.id),
      D.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id),
    ]);
    if (res[1]!.meta.changes !== 1) return err(c, 409, 'This recipe was already sent in for review, so your changes were not saved.');
    return c.json({ id, slug }, 200, NO_STORE);
  }
  const sourceId = `src-${id}`;
  // The draft-count cap is checked inside the inserts themselves (same transaction), so
  // concurrent creates cannot overshoot it. Nothing is written when the cap is hit.
  const room = "(SELECT count(*) FROM recipes r JOIN recipe_locales l ON l.recipe_id = r.id WHERE r.owner_user_id = ? AND l.status <> 'rejected') < ? AND (SELECT count(*) FROM recipes WHERE owner_user_id = ?) < ?";
  const res = await D.batch([
    D.prepare(`INSERT INTO sources (id,name,url,license,cleared_at,notes) SELECT ?,?,?,?,NULL,? WHERE ${room}`).bind(sourceId, sub.source.name, sub.source.url, sub.source.license, 'user submission - rights review pending', user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
    D.prepare(`INSERT INTO recipes (id,source_id,origin_country,image_key,created_at,prep_minutes,cook_minutes,base_servings,owner_user_id,attested_at,author_name) SELECT ?,?,?,NULL,?,?,?,?,?,?,? WHERE ${room}`).bind(id, sourceId, sub.originCountry ?? null, now, prep, cook, serv, user.id, s.attest ? now : null, s.displayName, user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
    D.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,intro,ingredients_json,steps_json,status) SELECT ?,?,?,?,?,?,?,?,'draft' WHERE EXISTS (SELECT 1 FROM recipes WHERE id = ?)").bind(id, loc.country, loc.lang, loc.title, slug, loc.intro ?? null, ing, stp, id),
    D.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id),
  ]);
  if (res[1]!.meta.changes !== 1) {
    const life = await D.prepare('SELECT count(*) AS n FROM recipes WHERE owner_user_id = ?').bind(user.id).first<{ n: number }>();
    const msg = (life?.n ?? 0) >= MAX_ROWS_PER_USER
      ? 'This account has reached its limit of saved recipes, including removed ones. Removing more will not free space here.'
      : `You can keep up to ${MAX_DRAFTS_PER_USER} drafts. Remove one first.`;
    return errors(c, [msg]);
  }
  return c.json({ id, slug }, 201, NO_STORE);
};
appApi.post('/me/recipes', saveDraft);
appApi.put('/me/recipes/:id', saveDraft);

appApi.post('/me/recipes/:id/submit', async (c) => {
  const user = c.get('user')!;
  if (await limited(c.env.RL_SUBMIT, c, 'submit')) return err(c, 429, 'Too many tries. Please wait a minute.');
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return err(c, 404, 'Draft not found.');
  if (row.r.submittedAt || row.l.status === 'published') return err(c, 409, 'Already sent in for review.');
  if (!row.r.attestedAt) return err(c, 409, 'Confirm the permission flag on the draft before sending it in.');
  const now = new Date().toISOString();
  const flip = await c.env.DB.prepare('UPDATE recipes SET submitted_at = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND attested_at IS NOT NULL').bind(now, row.r.id, user.id).run();
  if (flip.meta.changes !== 1) return err(c, 409, 'Already sent in for review.');
  // The admin queue (MCP recipes.list submitted:true) is the source of truth; the email is an extra,
  // counted against the same daily mail budget as login codes.
  if (c.env.REVIEW_NOTIFY_TO && (await reserveMail(c.env.DB, 'notice', NOTICES_PER_DAY))) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks recipe submitted for review: ${row.l.title}`.slice(0, 180),
      text: `A recipe was sent in for review (native app).\n\nTitle: ${row.l.title}\nRecipe id: ${row.r.id}\nAuthor shown as: ${row.r.authorName ?? user.displayName ?? ''}\nSubmitter: ${user.email}\nSource: ${row.s.name} (${row.s.url}), license label ${row.s.license}\nAuthor confirmed rights at: ${row.r.attestedAt}\n\nIt stays a private draft until you clear the source and publish it with the admin tools. Queue: MCP recipes.list with submitted:true.\n`,
    }).catch(() => false);
  }
  return c.json({ ok: true, submittedAt: now }, 200, NO_STORE);
});

// "Remove" never deletes data: the locale is marked rejected (hidden from the owner's list), rows stay for review/audit.
appApi.delete('/me/recipes/:id', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    "UPDATE recipe_locales SET status = 'rejected' WHERE recipe_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL)",
  ).bind(id, id, user.id).run();
  if (r.meta.changes !== 1) return err(c, 404, 'Draft not found, or it was already sent in for review.');
  return c.json({ ok: true }, 200, NO_STORE);
});

// --- Published recipe detail (JSON mirror of the recipe page) -----------------

appApi.get('/recipes/:country/:lang/:slug', async (c) => {
  const db = createDb(c.env.DB);
  // ALLOW_DEMO_SEED lives on the worker Bindings (index.ts); read it loosely here.
  const allowDemo = (c.env as { ALLOW_DEMO_SEED?: string }).ALLOW_DEMO_SEED === 'true';
  const rows = await db
    .select()
    .from(recipeLocales)
    .innerJoin(recipes, eq(recipeLocales.recipeId, recipes.id))
    .innerJoin(sources, eq(recipes.sourceId, sources.id))
    .where(and(
      eq(recipeLocales.country, c.req.param('country')),
      eq(recipeLocales.lang, c.req.param('lang')),
      eq(recipeLocales.slug, c.req.param('slug')),
      published(db, allowDemo),
    ))
    .limit(1);
  const row = rows[0];
  if (!row) return err(c, 404, 'Recipe not found.');
  const recipeId = row.recipe_locales.recipeId;
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;

  // Same image gates as the page: rights-cleared rows only, newest first.
  const heroRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, recipeId), eq(recipeImages.kind, 'hero'), isNotNull(recipeImages.clearedAt)))
    .orderBy(desc(recipeImages.createdAt))
    .limit(1);
  const stepRows = await db
    .select({ id: recipeImages.id, style: recipeImages.style, stepIndex: recipeImages.stepIndex })
    .from(recipeImages)
    .where(and(eq(recipeImages.recipeId, recipeId), eq(recipeImages.kind, 'step'), isNotNull(recipeImages.clearedAt)))
    .orderBy(desc(recipeImages.createdAt));

  const ingredients = parseIngredientEntries(row.recipe_locales.ingredientsJson);
  const steps = parseStepLines(row.recipe_locales.stepsJson);
  const stepImages: ({ url: string; style: string } | null)[] = Array.from({ length: steps.length }, () => null);
  for (const img of stepRows) {
    const idx = img.stepIndex ?? -1;
    if (idx < 0 || idx >= steps.length || stepImages[idx]) continue;
    stepImages[idx] = { url: `${origin}/img/recipe/${img.id}`, style: img.style };
  }
  return c.json({
    recipe: {
      id: row.recipes.id,
      originCountry: row.recipes.originCountry,
      createdAt: row.recipes.createdAt,
      testedAt: row.recipes.testedAt,
      testedBy: row.recipes.testedBy,
      prepMinutes: row.recipes.prepMinutes,
      cookMinutes: row.recipes.cookMinutes,
      restMinutes: row.recipes.restMinutes,
      totalMinutes: row.recipes.totalMinutes,
      baseServings: row.recipes.baseServings,
      category: row.recipes.category,
      authorName: row.recipes.authorName,
    },
    locale: {
      recipeId,
      country: row.recipe_locales.country,
      lang: row.recipe_locales.lang,
      title: row.recipe_locales.title,
      slug: row.recipe_locales.slug,
      intro: row.recipe_locales.intro,
      ingredients,
      steps,
    },
    heroImage: heroRows[0] ? { url: `${origin}/img/recipe/${heroRows[0].id}`, style: heroRows[0].style } : null,
    stepImages,
    source: { name: row.sources.name, url: row.sources.url, license: row.sources.license },
  }, 200, { 'cache-control': 'public, max-age=300' });
});
