// Accounts (email-code sign-in) and user-owned private recipe drafts.
// Everything here is server-rendered HTML + plain form posts (no client JS).
// Publication is NOT possible from this module: a submit only flags the draft
// for review; an admin publishes through the MCP after rights clearance.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq, and, desc } from 'drizzle-orm';
import { LOCALES, getCountry, localizedCountryName, slugify, validateRecipeSubmission } from '@2yolks/contracts';
import { renderAccountPage, escapeHtml as esc } from '@2yolks/web/server';
import { createDb, recipes, recipeLocales, recipeSlugAliases, sources, users } from './db';
import { sendMail, type MailEnv } from './email';
import { parseRecipeText, parseJsonLdRecipe, type ParsedRecipe } from './parse';
import { safeFetchText, SsrfError } from './ssrf';

type RateLimiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };
export type AccountBindings = MailEnv & {
  DB: D1Database;
  CANONICAL_ORIGIN?: string;
  /** Where "submitted for review" notices go (secret, never committed). */
  REVIEW_NOTIFY_TO?: string;
  /** Optional Workers rate-limit bindings (approximate, per location). Absent = skipped. */
  RL_AUTH?: RateLimiter;
  RL_SUBMIT?: RateLimiter;
};

export const SESSION_COOKIE = '__Host-2y_sid';
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const CODES_PER_EMAIL_10MIN = 3;
const CODES_PER_DAY = 80; // keeps headroom under the Resend free 100/day cap
const MAX_DRAFTS_PER_USER = 50;

export const accountApp = new Hono<{ Bindings: AccountBindings; Variables: { user: { id: string; email: string; displayName: string | null } } }>();
type Ctx = Context<{ Bindings: AccountBindings; Variables: { user: { id: string; email: string; displayName: string | null } } }>;

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomCode(): string {
  const a = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(a); if (a[0]! < 4_294_000_000) return String(a[0]! % 1_000_000).padStart(6, '0'); }
}
function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const normEmail = (v: unknown): string | null => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(e) ? e : null;
};
const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : '');

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

async function limited(rl: RateLimiter | undefined, c: Ctx, scope: string): Promise<boolean> {
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
<p class="lead">We sent a 6-digit code to ${esc(email)}. It works for 10 minutes.</p>${msg}
<form method="post" action="/account/verify"><input type="hidden" name="email" value="${esc(email)}"><label>6-digit code<input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" required></label><button type="submit">Sign in</button></form>`;

accountApp.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return page(c, 'Sign in', signInForm());
  const db = createDb(c.env.DB);
  const rows = await db.select({ id: recipes.id, submittedAt: recipes.submittedAt, title: recipeLocales.title, status: recipeLocales.status })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id))
    .where(eq(recipes.ownerUserId, user.id)).orderBy(desc(recipes.createdAt));
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
  const recent = await c.env.DB.prepare('SELECT count(*) AS n FROM auth_codes WHERE email = ? AND created_at > ?').bind(email, now - CODE_TTL_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= CODES_PER_EMAIL_10MIN) return page(c, 'Slow down', signInForm(banner('err', 'Too many codes requested for this email. Try again in a few minutes.')), 429);
  const day = await c.env.DB.prepare('SELECT count(*) AS n FROM auth_codes WHERE created_at > ?').bind(now - 86_400_000).first<{ n: number }>();
  if ((day?.n ?? 0) >= CODES_PER_DAY) return page(c, 'Busy', signInForm(banner('err', 'Sign-in is busy right now. Please try again tomorrow.')), 503);
  const code = randomCode();
  const id = newId();
  await c.env.DB.prepare('INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,used,created_at) VALUES (?,?,?,?,0,0,?)')
    .bind(id, email, await sha256Hex(`${email}:${code}`), now + CODE_TTL_MS, now).run();
  const sent = await sendMail(c.env, { to: email, subject: `Your 2yolks code: ${code}`, text: `Your 2yolks sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.\n` });
  if (!sent) {
    await c.env.DB.prepare('DELETE FROM auth_codes WHERE id = ?').bind(id).run();
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
  const row = await c.env.DB.prepare('SELECT id, code_hash AS hash, attempts FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1')
    .bind(email, now).first<{ id: string; hash: string; attempts: number }>();
  if (!row || row.attempts >= MAX_ATTEMPTS) return page(c, 'Sign in', signInForm(banner('err', 'That code expired or was used up. Request a new one.')), 400);
  await c.env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
  const given = await sha256Hex(`${email}:${code}`);
  let diff = given.length ^ row.hash.length;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ (row.hash.charCodeAt(i) || 0);
  if (diff !== 0) return page(c, 'Check your email', codeForm(email, banner('err', 'That code is not right.')), 400);
  await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(row.id).run();
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    const id = newId();
    await c.env.DB.prepare('INSERT INTO users (id,email,display_name,created_at) VALUES (?,?,NULL,?)').bind(id, email, new Date().toISOString()).run();
    user = { id };
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

type FormState = {
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

function renderForm(s: FormState, errors: string[] = [], note = ''): string {
  const errBox = errors.length ? banner('err', `<strong>Fix these first:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) : '';
  const entry = s.id ? '' : `<div class="panel"><h2>Start faster</h2>
<form method="post" action="/account/recipes/paste"><label>Paste a recipe<small>Plain text with a title line, then "Ingredients" and "Instructions". You review everything before saving.</small><textarea name="text" maxlength="60000"></textarea></label><button class="quiet" type="submit">Fill the form from this text</button></form>
<form method="post" action="/account/recipes/import"><label>Or import from a link<small>Only your own recipe, or one you have permission to share. We read the page's recipe data and nothing else.</small><input type="url" name="url" maxlength="2000" placeholder="https://"></label><button class="quiet" type="submit">Fill the form from this link</button></form></div>`;
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

function parseForm(form: Record<string, unknown>, user: { displayName: string | null }): FormState {
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

function buildSubmission(s: FormState, origin: string) {
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

async function loadOwned(c: Ctx, id: string) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const rows = await db.select({ r: recipes, l: recipeLocales, s: sources })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id)).innerJoin(sources, eq(sources.id, recipes.sourceId))
    .where(and(eq(recipes.id, id), eq(recipes.ownerUserId, user.id))).limit(1);
  return rows[0] ?? null;
}

accountApp.get('/recipes/new', (c) => page(c, 'Add a recipe', renderForm(blank(c.get('user')))));

accountApp.post('/recipes/paste', async (c) => {
  const form = await c.req.parseBody();
  const p = parseRecipeText(str(form['text'], 60000));
  const warn = p.warnings.length ? banner('err', p.warnings.map(esc).join('<br>')) : banner('ok', 'Filled from your text. Check every line, then save.');
  return page(c, 'Add a recipe', renderForm(fromParsed(blank(c.get('user')), p), [], warn));
});

accountApp.post('/recipes/import', async (c) => {
  const user = c.get('user');
  if (await limited(c.env.RL_SUBMIT, c, 'import')) return page(c, 'Slow down', renderForm(blank(user), ['Too many imports. Please wait a minute.']), 429);
  const form = await c.req.parseBody();
  const url = str(form['url'], 2000).trim();
  try {
    const { url: finalUrl, text } = await safeFetchText(url);
    const p = parseJsonLdRecipe(text);
    if (!p) return page(c, 'Add a recipe', renderForm(blank(user), ['That page has no recipe data we can read. Paste the text instead.']), 400);
    const s = { ...fromParsed(blank(user), p), sourceKind: 'adapted' as const, sourceUrl: finalUrl };
    return page(c, 'Add a recipe', renderForm(s, [], banner('ok', `Filled from ${esc(new URL(finalUrl).hostname)}. It is saved as "adapted" with a link back. Only keep it if you have the right to share it.`)));
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : 'We could not read that link.';
    return page(c, 'Add a recipe', renderForm(blank(user), [msg]), 400);
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
    displayName: user.displayName ?? '', sourceKind: row.s.license === 'user-adapted' ? 'adapted' : 'original', sourceUrl: row.s.license === 'user-adapted' ? row.s.url : '',
    attest: !!row.r.attestedAt,
  };
  const saved = c.req.query('saved') ? banner('ok', 'Saved as a private draft.') : '';
  const submit = `<form method="post" action="/account/recipes/${esc(row.r.id)}/submit"><div class="panel"><h2>Send in for review</h2><p class="hint">We check the recipe and its rights before anything is published. Publishing is never automatic.${row.r.attestedAt ? '' : ' Tick the permission box above and save first.'}</p><button type="submit"${row.r.attestedAt ? '' : ' disabled'}>Send in for review</button></div></form>
<form method="post" action="/account/recipes/${esc(row.r.id)}/delete"><button class="quiet" type="submit">Delete this draft</button></form>`;
  return page(c, 'Edit draft', renderForm(s, [], saved) + submit);
});

accountApp.post('/recipes/save', async (c) => {
  const user = c.get('user');
  if (await limited(c.env.RL_SUBMIT, c, 'save')) return page(c, 'Slow down', renderForm(blank(user), ['Too many saves. Please wait a minute.']), 429);
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
  if (errors.length || !result || !result.ok) return page(c, 'Add a recipe', renderForm(s, errors), 400);

  const db = createDb(c.env.DB);
  const sub = result.value;
  const loc = sub.locales[0]!;
  let id = s.id;
  if (id) {
    const owned = await loadOwned(c, id);
    if (!owned) return page(c, 'Not found', banner('err', 'Draft not found.'), 404);
    if (owned.r.submittedAt || owned.l.status === 'published') return page(c, 'Submitted', banner('err', 'This recipe was already sent in for review.'), 409);
  } else {
    const count = await c.env.DB.prepare('SELECT count(*) AS n FROM recipes WHERE owner_user_id = ?').bind(user.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_DRAFTS_PER_USER) return page(c, 'Add a recipe', renderForm(s, [`You can keep up to ${MAX_DRAFTS_PER_USER} drafts. Delete one first.`]), 400);
    id = newId();
  }
  const slug = `${slugify(loc.title) || 'recipe'}-${id}`.slice(0, 120);
  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id).run();
  const recipeFields = {
    originCountry: sub.originCountry ?? null,
    prepMinutes: (sub as unknown as Record<string, number | undefined>)['prepMinutes'] ?? null,
    cookMinutes: (sub as unknown as Record<string, number | undefined>)['cookMinutes'] ?? null,
    baseServings: (sub as unknown as Record<string, number | undefined>)['baseServings'] ?? null,
    attestedAt: s.attest ? now : null,
  };
  if (s.id) {
    const owned = (await loadOwned(c, id))!;
    await db.update(sources).set({ name: sub.source.name, url: sub.source.url, license: sub.source.license }).where(eq(sources.id, owned.r.sourceId));
    await db.update(recipes).set(recipeFields).where(and(eq(recipes.id, id), eq(recipes.ownerUserId, user.id)));
    await db.delete(recipeLocales).where(eq(recipeLocales.recipeId, id));
  } else {
    const sourceId = `src-${id}`;
    await db.insert(sources).values({ id: sourceId, name: sub.source.name, url: sub.source.url, license: sub.source.license, clearedAt: null, notes: 'user submission - rights review pending' });
    await db.insert(recipes).values({ id, sourceId, imageKey: null, createdAt: now, ownerUserId: user.id, ...recipeFields });
  }
  await db.insert(recipeLocales).values({
    recipeId: id, country: loc.country, lang: loc.lang, title: loc.title, slug, intro: loc.intro ?? null,
    ingredientsJson: JSON.stringify(loc.ingredients), stepsJson: JSON.stringify(loc.steps), status: 'draft',
  });
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
  await createDb(c.env.DB).update(recipes).set({ submittedAt: now }).where(and(eq(recipes.id, row.r.id), eq(recipes.ownerUserId, user.id)));
  if (c.env.REVIEW_NOTIFY_TO) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks recipe submitted for review: ${row.l.title}`.slice(0, 180),
      text: `A recipe was sent in for review.\n\nTitle: ${row.l.title}\nRecipe id: ${row.r.id}\nAuthor shown as: ${user.displayName ?? ''}\nSubmitter: ${user.email}\nSource: ${row.s.name} (${row.s.url}), license label ${row.s.license}\nAuthor confirmed rights at: ${row.r.attestedAt}\n\nIt stays a private draft until you clear the source and publish it with the admin tools.\n`,
    }).catch(() => false);
  }
  return page(c, 'Sent in', `<h1>Thanks, it is with us</h1><p class="lead">We will review "${esc(row.l.title)}" and its rights before anything goes live. Nothing is published automatically.</p><p><a class="btn" href="/account">Back to your recipes</a></p>`);
});

accountApp.post('/recipes/:id/delete', async (c) => {
  const user = c.get('user');
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, 'Not found', banner('err', 'Draft not found.'), 404);
  if (row.l.status === 'published') return page(c, 'Published', banner('err', 'Published recipes cannot be deleted here. Contact us.'), 409);
  const db = createDb(c.env.DB);
  await db.delete(recipeSlugAliases).where(eq(recipeSlugAliases.recipeId, row.r.id));
  await db.delete(recipeLocales).where(eq(recipeLocales.recipeId, row.r.id));
  await db.delete(recipes).where(and(eq(recipes.id, row.r.id), eq(recipes.ownerUserId, user.id)));
  await db.delete(sources).where(eq(sources.id, row.r.sourceId));
  return c.redirect('/account', 303);
});
