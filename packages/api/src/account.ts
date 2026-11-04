// Accounts (email-code sign-in) and user-owned private recipe drafts.
// Everything here is server-rendered HTML + plain form posts (no client JS).
// Publication is NOT possible from this module: a submit only flags the draft
// for review; an admin publishes through the MCP after rights clearance.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq, and, ne, desc } from 'drizzle-orm';
import { LOCALES, getCountry, localizedCountryName, slugify, validateRecipeSubmission } from '@2yolks/contracts';
import { renderAccountPage, escapeHtml as esc } from '@2yolks/web/server';
import { createDb, recipes, recipeLocales, sources, users } from './db';
import { sendMail, type MailEnv } from './email';
import { parseRecipeText, parseJsonLdRecipe, type ParsedRecipe } from './parse';
import { safeFetchText, SsrfError } from './ssrf';

type RateLimiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };
export type AccountBindings = MailEnv & {
  DB: D1Database;
  CANONICAL_ORIGIN?: string;
  /** Where "submitted for review" notices go (secret, never committed). */
  REVIEW_NOTIFY_TO?: string;
  /** 'true' turns on link import. Default OFF (DNS-rebinding residual, see ssrf.ts). */
  IMPORT_ENABLED?: string;
  /** Optional Workers rate-limit bindings (approximate, per location). Absent = skipped. */
  RL_AUTH?: RateLimiter;
  RL_SUBMIT?: RateLimiter;
};

export const SESSION_COOKIE = '__Host-2y_sid';
export const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const CODES_PER_EMAIL_10MIN = 3;
export const CODES_PER_DAY = 32; // login codes per rolling 24h, counted by kind. The Resend free plan (100/day, 3,000/month) is shared with other sites
export const NOTICES_PER_DAY = 8; // review notices per rolling 24h, counted by kind; 32 + 8 = 40/day hard total
export const MAX_DRAFTS_PER_USER = 50; // active (not removed) drafts
export const MAX_ROWS_PER_USER = 500; // lifetime rows incl. removed ones, so remove/recreate loops cannot grow storage forever

export const accountApp = new Hono<{ Bindings: AccountBindings; Variables: { user: { id: string; email: string; displayName: string | null } } }>();
type Ctx = Context<{ Bindings: AccountBindings; Variables: { user: { id: string; email: string; displayName: string | null } } }>;

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomCode(): string {
  const a = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(a); if (a[0]! < 4_294_000_000) return String(a[0]! % 1_000_000).padStart(6, '0'); }
}
export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
export const normEmail = (v: unknown): string | null => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(e) ? e : null;
};
export const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : '');

function page(c: Ctx, title: string, body: string, status: 200 | 400 | 403 | 404 | 409 | 429 | 503 = 200) {
  return c.html(renderAccountPage(title, body), status, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
}
const banner = (kind: 'err' | 'ok', msg: string) => `<div class="${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${msg}</div>`;

// --- CSRF: SameSite=Lax cookie plus an Origin check on every mutating request.
accountApp.use('*', async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('origin');
    const allowed = new Set([new URL(c.req.url).origin]);
    if (c.env.CANONICAL_ORIGIN) allowed.add(c.env.CANONICAL_ORIGIN);
    if (!origin || !allowed.has(origin)) return page(c, 'Blocked', banner('err', 'This request did not come from 2yolks.com, so it was blocked.'), 403);
  }
  await next();
});

/** Atomically reserve one outbound email against the daily budget (single conditional INSERT). */
export async function reserveMail(db: D1Database, kind: 'code' | 'notice', cap: number): Promise<boolean> {
  const now = Date.now();
  const r = await db.prepare(
    'INSERT INTO mail_log (id, kind, created_at) SELECT ?, ?, ? WHERE (SELECT count(*) FROM mail_log WHERE kind = ? AND created_at > ?) < ?',
  ).bind(newId() + newId(), kind, now, kind, now - 86_400_000, cap).run();
  return r.meta.changes === 1;
}

/** Drop expired sign-in artifacts only (codes, sessions, old mail counters). Never touches recipes or users. */
export async function cleanupExpired(db: D1Database, now: number): Promise<void> {
  try {
    await db.batch([
      db.prepare('DELETE FROM auth_codes WHERE expires_at < ?').bind(now - 86_400_000),
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM mail_log WHERE created_at < ?').bind(now - 2 * 86_400_000),
    ]);
  } catch { /* housekeeping must never block sign-in */ }
}

// Cap request bodies before anything is parsed or buffered (streaming-safe).
accountApp.use('*', bodyLimit({
  maxSize: 256 * 1024,
  onError: (c) => c.html(renderAccountPage('Too large', '<div class="err" role="alert">That request is too large.</div>'), 413),
}));

export async function limited(rl: RateLimiter | undefined, c: Ctx, scope: string): Promise<boolean> {
  if (!rl) return false;
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  try { return !(await rl.limit({ key: `${scope}:${ip}` })).success; } catch { return false; }
}

async function currentUser(c: Ctx) {
  const tok = getCookie(c, SESSION_COOKIE);
  if (!tok || !/^[0-9a-f]{64}$/.test(tok)) return null;
  const id = await sha256Hex(tok);
  const row = await c.env.DB.prepare(
    'SELECT u.id AS id, u.email AS email, u.display_name AS displayName FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
  ).bind(id, Date.now()).first<{ id: string; email: string; displayName: string | null }>();
  return row ?? null;
}

accountApp.use('*', async (c, next) => {
  const u = await currentUser(c);
  if (u) c.set('user', u);
  await next();
});

// --- Views -------------------------------------------------------------------

const signInForm = (msg = '') => `<h1>Your 2yolks account</h1>
<p class="lead">Sign in with an email code to keep private drafts and send a recipe in for review. No password to remember.</p>${msg}
<form method="post" action="/account/code"><label>Email<input type="email" name="email" required autocomplete="email" maxlength="254"></label><button type="submit">Email me a code</button></form>
<p class="hint">Drafts stay private to you. Nothing is published until it has been reviewed.</p>`;

const codeForm = (email: string, msg = '') => `<h1>Check your email</h1>
<p class="lead">We sent a 6-digit code to ${esc(email)}. It works for 10 minutes. If you asked for more than one, use the code from the most recent request; older codes stop working.</p>${msg}
<form method="post" action="/account/verify"><input type="hidden" name="email" value="${esc(email)}"><label>6-digit code<input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" required></label><button type="submit">Sign in</button></form>`;

accountApp.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return page(c, 'Sign in', signInForm());
  const db = createDb(c.env.DB);
  const rows = await db.select({ id: recipes.id, submittedAt: recipes.submittedAt, title: recipeLocales.title, status: recipeLocales.status })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id))
    .where(and(eq(recipes.ownerUserId, user.id), ne(recipeLocales.status, 'rejected'))).orderBy(desc(recipes.createdAt));
  const items = rows.map((r) => {
    const label = r.status === 'published' ? 'Published' : r.submittedAt ? 'Submitted for review' : 'Private draft';
    const edit = r.submittedAt || r.status === 'published' ? '' : `<a href="/account/recipes/${esc(r.id)}/edit">Edit</a>`;
    return `<li><span><strong>${esc(r.title)}</strong><br><span class="badge">${label}</span></span><span>${edit}</span></li>`;
  }).join('');
  return page(c, 'Your recipes', `<h1>Your recipes</h1><p class="lead">Signed in as ${esc(user.email)}.</p>
<p><a class="btn" href="/account/recipes/new">Add a recipe</a></p>
<div class="panel"><h2>Your drafts</h2>${items ? `<ul class="mine">${items}</ul>` : '<p class="hint">Nothing yet. Start from a form, pasted text or a link.</p>'}</div>
<form method="post" action="/account/logout"><button class="quiet" type="submit">Sign out</button></form>`);
});

accountApp.post('/code', async (c) => {
  if (await limited(c.env.RL_AUTH, c, 'code')) return page(c, 'Slow down', signInForm(banner('err', 'Too many tries. Please wait a minute.')), 429);
  const form = await c.req.parseBody();
  const email = normEmail(form['email']);
  if (!email) return page(c, 'Sign in', signInForm(banner('err', 'Enter a valid email address.')), 400);
  if (!c.env.RESEND_API_KEY) return page(c, 'Sign in', signInForm(banner('err', 'Sign-in email is not switched on yet.')), 503);
  const now = Date.now();
  await cleanupExpired(c.env.DB, now);
  const code = randomCode();
  const id = newId();
  // Per-email budget first (atomic INSERT ... SELECT ... WHERE count<3) so rejected retries never spend site budget.
  const ins = await c.env.DB.prepare(
    'INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,used,created_at) SELECT ?,?,?,?,0,0,? WHERE (SELECT count(*) FROM auth_codes WHERE email = ? AND created_at > ?) < ?',
  ).bind(id, email, await sha256Hex(`${email}:${code}`), now + CODE_TTL_MS, now, email, now - CODE_TTL_MS, CODES_PER_EMAIL_10MIN).run();
  if (ins.meta.changes !== 1) return page(c, 'Slow down', signInForm(banner('err', 'Too many codes requested for this email. Try again in a few minutes.')), 429);
  // Then the site-wide daily mail budget (atomic conditional INSERT). No budget: the code is never sent, so kill it.
  if (!(await reserveMail(c.env.DB, 'code', CODES_PER_DAY))) {
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return page(c, 'Busy', signInForm(banner('err', 'Sign-in is busy right now. Please try again tomorrow.')), 503);
  }
  // Only the newest code stays valid. Order by insertion (rowid), so a concurrently issued newer code is never invalidated by an older request.
  await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE email = ? AND used = 0 AND rowid < (SELECT rowid FROM auth_codes WHERE id = ?)').bind(email, id).run();
  const sent = await sendMail(c.env, { to: email, subject: `Your 2yolks code: ${code}`, text: `Your 2yolks sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.\n` });
  if (!sent) {
    // No refund: delivery state is ambiguous, so the budget slot and per-email slot stay used. Invalidate the code.
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return page(c, 'Sign in', signInForm(banner('err', 'We could not send the email. Please try again later.')), 503);
  }
  return page(c, 'Check your email', codeForm(email));
});

accountApp.post('/verify', async (c) => {
  if (await limited(c.env.RL_AUTH, c, 'verify')) return page(c, 'Slow down', signInForm(banner('err', 'Too many tries. Please wait a minute.')), 429);
  const form = await c.req.parseBody();
  const email = normEmail(form['email']);
  const code = str(form['code'], 12).trim();
  if (!email || !/^\d{6}$/.test(code)) return page(c, 'Check your email', codeForm(email ?? '', banner('err', 'Enter the 6-digit code.')), 400);
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT id, code_hash AS hash FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > ? AND attempts < ? ORDER BY rowid DESC LIMIT 1')
    .bind(email, now, MAX_ATTEMPTS).first<{ id: string; hash: string }>();
  if (!row) return page(c, 'Sign in', signInForm(banner('err', 'That code expired or was used up. Request a new one.')), 400);
  // Claim one attempt atomically; concurrent guesses cannot exceed the cap.
  const claim = await c.env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ? AND used = 0 AND attempts < ? AND expires_at > ?').bind(row.id, MAX_ATTEMPTS, now).run();
  if (claim.meta.changes !== 1) return page(c, 'Sign in', signInForm(banner('err', 'That code expired or was used up. Request a new one.')), 400);
  const given = await sha256Hex(`${email}:${code}`);
  let diff = given.length ^ row.hash.length;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ (row.hash.charCodeAt(i) || 0);
  if (diff !== 0) return page(c, 'Check your email', codeForm(email, banner('err', 'That code is not right.')), 400);
  // Single-use: exactly one concurrent correct submission can flip used 0 -> 1.
  const use = await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ? AND used = 0').bind(row.id).run();
  if (use.meta.changes !== 1) return page(c, 'Sign in', signInForm(banner('err', 'That code was already used. Request a new one.')), 400);
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (id,email,display_name,created_at) VALUES (?,?,NULL,?)').bind(newId(), email, new Date().toISOString()).run();
    user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (!user) return page(c, 'Sign in', signInForm(banner('err', 'Something went wrong. Please try again.')), 503);
  }
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), user.id, now + SESSION_DAYS * 86_400_000, now).run();
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86_400 });
  return c.redirect('/account', 303);
});

accountApp.post('/logout', async (c) => {
  const tok = getCookie(c, SESSION_COOKIE);
  if (tok && /^[0-9a-f]{64}$/.test(tok)) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(tok)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
  return c.redirect('/account', 303);
});

// Everything below needs a signed-in user.
accountApp.use('/recipes/*', async (c, next) => {
  if (!c.get('user')) return c.redirect('/account', 303);
  await next();
});

// --- Draft form --------------------------------------------------------------

export type FormState = {
  id?: string; title: string; intro: string; ingredients: string; steps: string; locale: string;
  prep: string; cook: string; servings: string; displayName: string; sourceKind: 'original' | 'adapted'; sourceUrl: string;
  attest: boolean;
};
const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français' };
const blank = (user: { displayName: string | null }): FormState => ({
  title: '', intro: '', ingredients: '', steps: '', locale: 'us:en', prep: '', cook: '', servings: '',
  displayName: user.displayName ?? '', sourceKind: 'original', sourceUrl: '', attest: false,
});
const fromParsed = (base: FormState, p: ParsedRecipe): FormState => ({
  ...base, title: p.title, intro: p.intro, ingredients: p.ingredients.join('\n'), steps: p.steps.join('\n'),
  prep: p.prepMinutes ? String(p.prepMinutes) : '', cook: p.cookMinutes ? String(p.cookMinutes) : '', servings: p.servings ? String(p.servings) : '',
});

function localeOptions(selected: string): string {
  return Object.entries(LOCALES).flatMap(([country, langs]) => langs.map((lang) => {
    const v = `${country}:${lang}`;
    return `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(LANG_NAMES[lang] ?? lang)} (${esc(localizedCountryName(country, lang))})</option>`;
  })).join('');
}

function renderForm(s: FormState, errors: string[] = [], note = '', importOn = false): string {
  const errBox = errors.length ? banner('err', `<strong>Fix these first:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) : '';
  const entry = s.id ? '' : `<div class="panel"><h2>Start faster</h2>
<form method="post" action="/account/recipes/paste"><label>Paste a recipe<small>Plain text with a title line, then "Ingredients" and "Instructions". You review everything before saving.</small><textarea name="text" maxlength="60000"></textarea></label><button class="quiet" type="submit">Fill the form from this text</button></form>
${importOn ? `<form method="post" action="/account/recipes/import"><label>Or import from a link<small>Only your own recipe, or one you have permission to share. We read the page's recipe data and nothing else.</small><input type="url" name="url" maxlength="2000" placeholder="https://"></label><button class="quiet" type="submit">Fill the form from this link</button></form>` : `<p class="hint"><strong>Import from a link</strong> is not available yet. Paste the recipe text above instead.</p>`}</div>`;
  return `<h1>${s.id ? 'Edit your draft' : 'Add a recipe'}</h1><p class="lead">Drafts are private to you until you send one in and we review it.</p>${note}${errBox}${entry}
<form method="post" action="/account/recipes/save">${s.id ? `<input type="hidden" name="id" value="${esc(s.id)}">` : ''}
<label>Recipe name<input type="text" name="title" value="${esc(s.title)}" maxlength="200" required></label>
<label>Language<select name="locale">${localeOptions(s.locale)}</select></label>
<label>Short intro <small>(optional)</small><textarea name="intro" maxlength="2000" style="min-height:4rem">${esc(s.intro)}</textarea></label>
<label>Ingredients<small>One per line, for example "2 cups flour".</small><textarea name="ingredients" required>${esc(s.ingredients)}</textarea></label>
<label>Steps<small>One step per line.</small><textarea name="steps" required>${esc(s.steps)}</textarea></label>
<div class="row"><label>Prep minutes<input type="number" name="prep" min="0" max="20000" value="${esc(s.prep)}"></label><label>Cook minutes<input type="number" name="cook" min="0" max="20000" value="${esc(s.cook)}"></label></div>
<label>Servings <small>(optional)</small><input type="number" name="servings" min="1" max="1000" step="any" value="${esc(s.servings)}"></label>
<label>Name to show as author<input type="text" name="display_name" value="${esc(s.displayName)}" maxlength="80" required></label>
<label>Where is this recipe from?<select name="source_kind"><option value="original"${s.sourceKind === 'original' ? ' selected' : ''}>I wrote it (my own recipe)</option><option value="adapted"${s.sourceKind === 'adapted' ? ' selected' : ''}>Adapted from, or shared with permission</option></select></label>
<label>Link to the original <small>(required if adapted or shared with permission)</small><input type="url" name="source_url" value="${esc(s.sourceUrl)}" maxlength="2000" placeholder="https://"></label>
<label class="check"><input type="checkbox" name="attest" value="1"${s.attest ? ' checked' : ''}><span>I wrote this recipe or have the right to share it. I let 2yolks publish it with credit to the name above, and I understand 2yolks reviews every recipe before it goes live and may decline or edit it.</span></label>
<button type="submit">Save private draft</button></form>`;
}

export function parseForm(form: Record<string, unknown>, user: { displayName: string | null }): FormState {
  const b = blank(user);
  const sk = str(form['source_kind'], 10) === 'adapted' ? 'adapted' : 'original';
  const loc = str(form['locale'], 10);
  return {
    id: /^[a-z0-9]{6,12}$/.test(str(form['id'], 14)) ? str(form['id'], 14) : undefined,
    title: str(form['title'], 200).trim(), intro: str(form['intro'], 2000).trim(),
    ingredients: str(form['ingredients'], 60000), steps: str(form['steps'], 60000),
    locale: loc.includes(':') ? loc : b.locale, prep: str(form['prep'], 8).trim(), cook: str(form['cook'], 8).trim(), servings: str(form['servings'], 8).trim(),
    displayName: str(form['display_name'], 80).trim(), sourceKind: sk, sourceUrl: str(form['source_url'], 2000).trim(),
    attest: str(form['attest'], 2) === '1',
  };
}

function lines(s: string, max = 80): string[] {
  return s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, max);
}

export function buildSubmission(s: FormState, origin: string) {
  const [country, lang] = s.locale.split(':');
  const host = (() => { try { return new URL(s.sourceUrl).hostname; } catch { return ''; } })();
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const body: Record<string, unknown> = {
    source: s.sourceKind === 'adapted'
      ? { name: `${s.displayName} (adapted from ${host || 'another source'})`.slice(0, 200), url: s.sourceUrl, license: 'user-adapted' }
      : { name: s.displayName, url: `${origin}/`, license: 'user-original' },
    originCountry: country,
    locales: [{ country, lang, title: s.title, ...(s.intro ? { intro: s.intro } : {}), ingredients: lines(s.ingredients), steps: lines(s.steps) }],
  };
  const times: Record<string, number | undefined> = { prepMinutes: num(s.prep), cookMinutes: num(s.cook), baseServings: num(s.servings) };
  for (const [k, v] of Object.entries(times)) if (v !== undefined) body[k] = v;
  return body;
}

export async function loadOwned(c: Ctx, id: string) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const rows = await db.select({ r: recipes, l: recipeLocales, s: sources })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id)).innerJoin(sources, eq(sources.id, recipes.sourceId))
    .where(and(eq(recipes.id, id), eq(recipes.ownerUserId, user.id), ne(recipeLocales.status, 'rejected'))).limit(1);
  return rows[0] ?? null;
}

const rf = (c: Ctx, s: FormState, errors: string[] = [], note = '') => renderForm(s, errors, note, c.env.IMPORT_ENABLED === 'true');

accountApp.get('/recipes/new', (c) => page(c, 'Add a recipe', rf(c, blank(c.get('user')))));

accountApp.post('/recipes/paste', async (c) => {
  const form = await c.req.parseBody();
  const p = parseRecipeText(str(form['text'], 60000));
  const warn = p.warnings.length ? banner('err', p.warnings.map(esc).join('<br>')) : banner('ok', 'Filled from your text. Check every line, then save.');
  return page(c, 'Add a recipe', rf(c, fromParsed(blank(c.get('user')), p), [], warn));
});

accountApp.post('/recipes/import', async (c) => {
  const user = c.get('user');
  if (c.env.IMPORT_ENABLED !== 'true') return page(c, 'Add a recipe', rf(c, blank(user), ['Link import is not switched on yet. Paste the recipe text instead.']), 404);
  if (await limited(c.env.RL_SUBMIT, c, 'import')) return page(c, 'Slow down', rf(c, blank(user), ['Too many imports. Please wait a minute.']), 429);
  const form = await c.req.parseBody();
  const url = str(form['url'], 2000).trim();
  try {
    const { url: finalUrl, text } = await safeFetchText(url);
    const p = parseJsonLdRecipe(text);
    if (!p) return page(c, 'Add a recipe', rf(c, blank(user), ['That page has no recipe data we can read. Paste the text instead.']), 400);
    const s = { ...fromParsed(blank(user), p), sourceKind: 'adapted' as const, sourceUrl: finalUrl };
    return page(c, 'Add a recipe', rf(c, s, [], banner('ok', `Filled from ${esc(new URL(finalUrl).hostname)}. It is saved as "adapted" with a link back. Only keep it if you have the right to share it.`)));
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : 'We could not read that link.';
    return page(c, 'Add a recipe', rf(c, blank(user), [msg]), 400);
  }
});

accountApp.get('/recipes/:id/edit', async (c) => {
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, 'Not found', banner('err', 'Draft not found.'), 404);
  if (row.r.submittedAt || row.l.status === 'published') return page(c, 'Submitted', banner('ok', 'This recipe was already sent in for review, so it can no longer be edited here.'), 409);
  const user = c.get('user');
  const ing = (JSON.parse(row.l.ingredientsJson) as unknown[]).map((x) => (typeof x === 'string' ? x : String((x as { name?: string }).name ?? ''))).join('\n');
  const s: FormState = {
    id: row.r.id, title: row.l.title, intro: row.l.intro ?? '', ingredients: ing, steps: (JSON.parse(row.l.stepsJson) as string[]).join('\n'),
    locale: `${row.l.country}:${row.l.lang}`, prep: row.r.prepMinutes?.toString() ?? '', cook: row.r.cookMinutes?.toString() ?? '', servings: row.r.baseServings?.toString() ?? '',
    displayName: row.r.authorName ?? user.displayName ?? '', sourceKind: row.s.license === 'user-adapted' ? 'adapted' : 'original', sourceUrl: row.s.license === 'user-adapted' ? row.s.url : '',
    attest: !!row.r.attestedAt,
  };
  const saved = c.req.query('saved') ? banner('ok', 'Saved as a private draft.') : '';
  const submit = `<form method="post" action="/account/recipes/${esc(row.r.id)}/submit"><div class="panel"><h2>Send in for review</h2><p class="hint">We check the recipe and its rights before anything is published. Publishing is never automatic.${row.r.attestedAt ? '' : ' Tick the permission box above and save first.'}</p><button type="submit"${row.r.attestedAt ? '' : ' disabled'}>Send in for review</button></div></form>
<form method="post" action="/account/recipes/${esc(row.r.id)}/delete"><button class="quiet" type="submit">Remove this draft</button></form>`;
  return page(c, 'Edit draft', rf(c, s, [], saved) + submit);
});

accountApp.post('/recipes/save', async (c) => {
  const user = c.get('user');
  if (await limited(c.env.RL_SUBMIT, c, 'save')) return page(c, 'Slow down', rf(c, blank(user), ['Too many saves. Please wait a minute.']), 429);
  const form = await c.req.parseBody();
  const s = parseForm(form, user);
  const errors: string[] = [];
  if (!s.displayName) errors.push('Add the name to show as author.');
  if (s.sourceKind === 'adapted' && !/^https:\/\//.test(s.sourceUrl)) errors.push('Adapted recipes need an https:// link to the original.');
  const [country, lang] = s.locale.split(':');
  if (!country || !lang || !(LOCALES[country] ?? []).includes(lang) || !getCountry(country)) errors.push('Pick a language from the list.');
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const result = errors.length ? null : validateRecipeSubmission(buildSubmission(s, origin));
  if (result && !result.ok) for (const f of result.errors) errors.push(`${f.path ? f.path.replace(/^locales\[0\]\./, '') + ': ' : ''}${f.message}`);
  if (errors.length || !result || !result.ok) return page(c, 'Add a recipe', rf(c, s, errors), 400);

  const sub = result.value;
  const loc = sub.locales[0]!;
  const D = c.env.DB;
  let id = s.id;
  if (id) {
    const owned = await loadOwned(c, id);
    if (!owned) return page(c, 'Not found', banner('err', 'Draft not found.'), 404);
    if (owned.r.submittedAt || owned.l.status === 'published') return page(c, 'Submitted', banner('err', 'This recipe was already sent in for review.'), 409);
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
  if (s.id) {
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
    if (res[1]!.meta.changes !== 1) return page(c, 'Submitted', banner('err', 'This recipe was already sent in for review, so your changes were not saved.'), 409);
  } else {
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
      return page(c, 'Add a recipe', renderForm(s, [msg]), 400);
    }
  }
  return c.redirect(`/account/recipes/${id}/edit?saved=1`, 303);
});

accountApp.post('/recipes/:id/submit', async (c) => {
  const user = c.get('user');
  if (await limited(c.env.RL_SUBMIT, c, 'submit')) return page(c, 'Slow down', banner('err', 'Too many tries. Please wait a minute.'), 429);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, 'Not found', banner('err', 'Draft not found.'), 404);
  if (row.r.submittedAt || row.l.status === 'published') return page(c, 'Submitted', banner('ok', 'Already sent in for review.'), 409);
  if (!row.r.attestedAt) return page(c, 'Permission needed', banner('err', 'Tick the permission box on the draft and save before sending it in.'), 409);
  const now = new Date().toISOString();
  const flip = await c.env.DB.prepare('UPDATE recipes SET submitted_at = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND attested_at IS NOT NULL').bind(now, row.r.id, user.id).run();
  if (flip.meta.changes !== 1) return page(c, 'Submitted', banner('ok', 'Already sent in for review.'), 409);
  // The admin queue (MCP recipes.list submitted:true) is the source of truth; the email is an extra,
  // counted against the same daily mail budget as login codes.
  if (c.env.REVIEW_NOTIFY_TO && (await reserveMail(c.env.DB, 'notice', NOTICES_PER_DAY))) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks recipe submitted for review: ${row.l.title}`.slice(0, 180),
      text: `A recipe was sent in for review.\n\nTitle: ${row.l.title}\nRecipe id: ${row.r.id}\nAuthor shown as: ${row.r.authorName ?? user.displayName ?? ''}\nSubmitter: ${user.email}\nSource: ${row.s.name} (${row.s.url}), license label ${row.s.license}\nAuthor confirmed rights at: ${row.r.attestedAt}\n\nIt stays a private draft until you clear the source and publish it with the admin tools. Queue: MCP recipes.list with submitted:true.\n`,
    }).catch(() => false);
  }
  return page(c, 'Sent in', `<h1>Thanks, it is with us</h1><p class="lead">We will review "${esc(row.l.title)}" and its rights before anything goes live. Nothing is published automatically.</p><p><a class="btn" href="/account">Back to your recipes</a></p>`);
});

// "Remove" never deletes data: the locale is marked rejected (hidden from the owner's list), rows stay for review/audit.
accountApp.post('/recipes/:id/delete', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    "UPDATE recipe_locales SET status = 'rejected' WHERE recipe_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL)",
  ).bind(id, id, user.id).run();
  if (r.meta.changes !== 1) return page(c, 'Not found', banner('err', 'Draft not found, or it was already sent in for review.'), 404);
  return c.redirect('/account', 303);
});
