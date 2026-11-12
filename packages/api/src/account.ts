// Accounts (email-code sign-in) and user-owned private recipe drafts.
// Everything here is server-rendered HTML + plain form posts (no client JS).
// Publication is NOT possible from this module: a submit only flags the draft
// for review; an admin publishes through the MCP after rights clearance.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq, and, ne, desc } from 'drizzle-orm';
import { LOCALES, getCountry, localizedCountryName, slugify, validateRecipeSubmission, RECIPE_CATEGORY_SLUGS, categoryLabel, isRecipeCategorySlug, CATEGORIES, accountStrings, fill, isAccountLang, validatorMessage, parseWarningMessage, ssrfMessage, type AccountStrings } from '@2yolks/contracts';
import { renderAccountPage, escapeHtml as esc, CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS } from '@2yolks/web/server';
import { createDb, recipes, recipeLocales, sources, users } from './db';
import { sendMail, type MailEnv } from './email';
import { parseRecipeText, parseJsonLdRecipe, type ParsedRecipe } from './parse';
import { safeFetchText, SsrfError } from './ssrf';
import { assistRecipe, reserveAiBudget, sanitizeMediaPart, DEFAULT_AI_DAILY_CAP, type AiAssistRequest } from './aiRecipe';
import { validateImage } from './imageValidation';

type RateLimiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };
export type AccountBindings = MailEnv & {
  DB: D1Database;
  IMAGES?: R2Bucket;
  CANONICAL_ORIGIN?: string;
  /** Where "submitted for review" notices go (secret, never committed). */
  REVIEW_NOTIFY_TO?: string;
  /** 'true' turns on link import. Default OFF (DNS-rebinding residual, see ssrf.ts). */
  IMPORT_ENABLED?: string;
  /** Optional Gemini API key for multimodal recipe capture & co-editing (gemini-3.8-flash). */
  GEMINI_API_KEY?: string;
  /** Optional daily cap override for AI invocations (defaults to 40/day). */
  AI_DAILY_CAP?: string;
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

// The whole account UI is localized en/es/fr. The language travels as ?lang=
// on every link, form action and redirect (English default keeps bare URLs).
const langOf = (c: Ctx): string => { const l = c.req.query('lang'); return isAccountLang(l) ? l : 'en'; };
const qs = (lang: string): string => (lang === 'en' ? '' : `?lang=${lang}`);
const qsAmp = (lang: string): string => (lang === 'en' ? '' : `&lang=${lang}`);

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
  const lang = langOf(c);
  return c.html(renderAccountPage(title, body, lang, new URL(c.req.url).pathname), status, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
}
const banner = (kind: 'err' | 'ok', msg: string) => `<div class="${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${msg}</div>`;

// --- CSRF: SameSite=Lax cookie plus an Origin check on every mutating request.
accountApp.use('*', async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('origin');
    const allowed = new Set([new URL(c.req.url).origin]);
    if (c.env.CANONICAL_ORIGIN) allowed.add(c.env.CANONICAL_ORIGIN);
    if (!origin || !allowed.has(origin)) { const t = accountStrings(langOf(c)); return page(c, t.titleBlocked, banner('err', t.errBlocked), 403); }
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
// Form routes stay capped at 256 KB; /recipes/ai-assist allows up to 1 MB for a client-resized photo + voice note.
const standardBodyLimit = bodyLimit({
  maxSize: 256 * 1024,
  onError: (c) => {
    const lang = langOf(c as Ctx);
    const t = accountStrings(lang);
    return c.html(renderAccountPage(t.titleTooLarge, `<div class="err" role="alert">${t.errTooLarge}</div>`, lang, new URL(c.req.url).pathname), 413);
  },
});
const aiBodyLimit = bodyLimit({
  maxSize: 1024 * 1024,
  onError: (c) => {
    const lang = langOf(c as Ctx);
    return c.json({ ok: false, error: accountStrings(lang).errTooLarge }, 413);
  },
});
const reportBodyLimit = bodyLimit({
  maxSize: 2 * 1024 * 1024,
  onError: (c) => {
    const lang = langOf(c as Ctx);
    const t = accountStrings(lang);
    return c.html(renderAccountPage(t.titleTooLarge, `<div class="err" role="alert">${t.errTooLarge}</div>`, lang, new URL(c.req.url).pathname), 413);
  },
});
accountApp.use('*', async (c, next) => {
  if (c.req.path.endsWith('/recipes/ai-assist')) return aiBodyLimit(c, next);
  if (c.req.path.endsWith('/test-report')) return reportBodyLimit(c, next);
  return standardBodyLimit(c, next);
});

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

const signInForm = (t: AccountStrings, lang: string, msg = '') => `<h1>${t.signInTitle}</h1>
<p class="lead">${t.signInLead}</p>${msg}
<form method="post" action="/account/code${qs(lang)}"><label>${t.signInEmailLabel}<input type="email" name="email" required autocomplete="email" maxlength="254"></label><button type="submit">${t.signInButton}</button></form>
<p class="hint">${t.signInHint}</p>`;

const codeForm = (t: AccountStrings, lang: string, email: string, msg = '') => `<h1>${t.codeTitle}</h1>
<p class="lead">${fill(t.codeLead, { email: esc(email) })}</p>${msg}
<form method="post" action="/account/verify${qs(lang)}"><input type="hidden" name="email" value="${esc(email)}"><label>${t.codeLabel}<input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" required></label><button type="submit">${t.codeButton}</button></form>`;

accountApp.get('/', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const user = c.get('user');
  if (!user) return page(c, t.signInPageTitle, signInForm(t, lang));
  const db = createDb(c.env.DB);
  const rows = await db.select({ id: recipes.id, submittedAt: recipes.submittedAt, title: recipeLocales.title, status: recipeLocales.status })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id))
    .where(and(eq(recipes.ownerUserId, user.id), ne(recipeLocales.status, 'rejected'))).orderBy(desc(recipes.createdAt));
  const items = rows.map((r) => {
    const label = r.status === 'published' ? t.statusPublished : r.submittedAt ? t.statusSubmitted : t.statusDraft;
    const edit = r.submittedAt || r.status === 'published' ? '' : `<a href="/account/recipes/${esc(r.id)}/edit${qs(lang)}">${t.editLink}</a>`;
    return `<li><span><strong>${esc(r.title)}</strong><br><span class="badge">${label}</span></span><span>${edit}</span></li>`;
  }).join('');
  return page(c, t.homePageTitle, `<h1>${t.homeTitle}</h1><p class="lead">${fill(t.homeLead, { email: esc(user.email) })}</p>
<p><a class="btn" href="/account/recipes/new${qs(lang)}">${t.addRecipe}</a></p>
<div class="panel"><h2>${t.yourDrafts}</h2>${items ? `<ul class="mine">${items}</ul>` : `<p class="hint">${t.emptyDrafts}</p>`}</div>
<form method="post" action="/account/logout${qs(lang)}"><button class="quiet" type="submit">${t.signOut}</button></form>`);
});

accountApp.post('/code', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_AUTH, c, 'code')) return page(c, t.titleSlowDown, signInForm(t, lang, banner('err', t.errTooManyTries)), 429);
  const form = await c.req.parseBody();
  const email = normEmail(form['email']);
  if (!email) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errInvalidEmail)), 400);
  if (!c.env.RESEND_API_KEY) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errSigninOff)), 503);
  const now = Date.now();
  await cleanupExpired(c.env.DB, now);
  const code = randomCode();
  const id = newId();
  // Per-email budget first (atomic INSERT ... SELECT ... WHERE count<3) so rejected retries never spend site budget.
  const ins = await c.env.DB.prepare(
    'INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,used,created_at) SELECT ?,?,?,?,0,0,? WHERE (SELECT count(*) FROM auth_codes WHERE email = ? AND created_at > ?) < ?',
  ).bind(id, email, await sha256Hex(`${email}:${code}`), now + CODE_TTL_MS, now, email, now - CODE_TTL_MS, CODES_PER_EMAIL_10MIN).run();
  if (ins.meta.changes !== 1) return page(c, t.titleSlowDown, signInForm(t, lang, banner('err', t.errTooManyCodes)), 429);
  // Then the site-wide daily mail budget (atomic conditional INSERT). No budget: the code is never sent, so kill it.
  if (!(await reserveMail(c.env.DB, 'code', CODES_PER_DAY))) {
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return page(c, t.titleBusy, signInForm(t, lang, banner('err', t.errBusy)), 503);
  }
  // Only the newest code stays valid. Order by insertion (rowid), so a concurrently issued newer code is never invalidated by an older request.
  await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE email = ? AND used = 0 AND rowid < (SELECT rowid FROM auth_codes WHERE id = ?)').bind(email, id).run();
  const sent = await sendMail(c.env, { to: email, subject: fill(t.mailSubject, { code }), text: fill(t.mailBody, { code }) });
  if (!sent) {
    // No refund: delivery state is ambiguous, so the budget slot and per-email slot stay used. Invalidate the code.
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errSendFailed)), 503);
  }
  return page(c, t.codePageTitle, codeForm(t, lang, email));
});

accountApp.post('/verify', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_AUTH, c, 'verify')) return page(c, t.titleSlowDown, signInForm(t, lang, banner('err', t.errTooManyTries)), 429);
  const form = await c.req.parseBody();
  const email = normEmail(form['email']);
  const code = str(form['code'], 12).trim();
  if (!email || !/^\d{6}$/.test(code)) return page(c, t.codePageTitle, codeForm(t, lang, email ?? '', banner('err', t.errEnterCode)), 400);
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT id, code_hash AS hash FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > ? AND attempts < ? ORDER BY rowid DESC LIMIT 1')
    .bind(email, now, MAX_ATTEMPTS).first<{ id: string; hash: string }>();
  if (!row) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errCodeExpired)), 400);
  // Claim one attempt atomically; concurrent guesses cannot exceed the cap.
  const claim = await c.env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ? AND used = 0 AND attempts < ? AND expires_at > ?').bind(row.id, MAX_ATTEMPTS, now).run();
  if (claim.meta.changes !== 1) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errCodeExpired)), 400);
  const given = await sha256Hex(`${email}:${code}`);
  let diff = given.length ^ row.hash.length;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ (row.hash.charCodeAt(i) || 0);
  if (diff !== 0) return page(c, t.codePageTitle, codeForm(t, lang, email, banner('err', t.errCodeWrong)), 400);
  // Single-use: exactly one concurrent correct submission can flip used 0 -> 1.
  const use = await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ? AND used = 0').bind(row.id).run();
  if (use.meta.changes !== 1) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errCodeUsed)), 400);
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (id,email,display_name,created_at) VALUES (?,?,NULL,?)').bind(newId(), email, new Date().toISOString()).run();
    user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (!user) return page(c, t.signInPageTitle, signInForm(t, lang, banner('err', t.errGeneric)), 503);
  }
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), user.id, now + SESSION_DAYS * 86_400_000, now).run();
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86_400 });
  return c.redirect(`/account${qs(lang)}`, 303);
});

accountApp.post('/logout', async (c) => {
  const tok = getCookie(c, SESSION_COOKIE);
  if (tok && /^[0-9a-f]{64}$/.test(tok)) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(tok)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
  return c.redirect(`/account${qs(langOf(c))}`, 303);
});

// Everything below needs a signed-in user.
accountApp.use('/recipes/*', async (c, next) => {
  if (!c.get('user')) return c.redirect(`/account${qs(langOf(c))}`, 303);
  await next();
});

// --- Draft form --------------------------------------------------------------

export type FormState = {
  id?: string; title: string; intro: string; ingredients: string; steps: string; locale: string; category: string;
  prep: string; cook: string; servings: string; displayName: string; sourceKind: 'original' | 'adapted'; sourceUrl: string;
  attest: boolean;
};
const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français' };
const blank = (user: { displayName: string | null }): FormState => ({
  title: '', intro: '', ingredients: '', steps: '', locale: 'us:en', category: '', prep: '', cook: '', servings: '',
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

// Capture-form chrome (category labels, prompt, preamble, live checks)
// follows the ACCOUNT UI language; the recipe locale select is recipe DATA
// and never re-localizes the chrome.
const FORM_STRINGS: Record<string, { prompt: string; unsure: string; preamble: string; preambleHint: string }> = {
  en: { prompt: 'What kind of dish is it?', unsure: 'Not sure yet', preamble: 'A sentence or two before the recipe', preambleHint: '(optional - the story or context a cook reads first)' },
  es: { prompt: '¿Qué tipo de plato es?', unsure: 'Aún no lo sé', preamble: 'Una o dos frases antes de la receta', preambleHint: '(opcional - la historia o el contexto que se lee primero)' },
  fr: { prompt: 'Quel type de plat est-ce ?', unsure: 'Pas encore sûr', preamble: 'Une phrase ou deux avant la recette', preambleHint: "(facultatif - l'histoire ou le contexte à lire en premier)" },
};

function categoryOptions(selected: string, lang: string): string {
  const t = FORM_STRINGS[lang]!;
  const opts = RECIPE_CATEGORY_SLUGS.map((cat) => `<option value="${cat}"${cat === selected ? ' selected' : ''}>${esc(categoryLabel(cat, lang) ?? cat)}</option>`).join('');
  return `<option value=""${selected === '' ? ' selected' : ''}>${esc(t.unsure)}</option>${opts}`;
}

/** JSON data islands for the live-check script: check strings + category
 * labels in every supported UI language (re-localization on language switch
 * without a reload). */
function captureDataIslands(): string {
  const catLabels: Record<string, Record<string, string>> = {};
  for (const lang of Object.keys(FORM_STRINGS)) {
    const t = FORM_STRINGS[lang]!;
    catLabels[lang] = { __prompt: t.prompt, __unsure: t.unsure, __preamble: t.preamble, __preambleHint: t.preambleHint };
    for (const cat of RECIPE_CATEGORY_SLUGS) catLabels[lang]![cat] = categoryLabel(cat, lang) ?? cat;
  }
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `<script type="application/json" id="capture-check-strings">${json(JSON.parse(CAPTURE_CHECK_STRINGS))}</script><script type="application/json" id="capture-cat-labels">${json(catLabels)}</script>`;
}

function renderForm(s: FormState, t: AccountStrings, acctLang: string, errors: string[] = [], note = '', importOn = false): string {
  const errBox = errors.length ? banner('err', `<strong>${t.fixThese}</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) : '';
  const aiPanel = `<div class="panel ai-panel" data-ai-panel data-ai-endpoint="/account/recipes/ai-assist${qs(acctLang)}" data-msg-working="${esc(t.aiWorking)}" data-msg-done-extract="${esc(t.aiDoneExtract)}" data-msg-done-polish="${esc(t.aiDonePolish)}" data-msg-done-translate="${esc(t.aiDoneTranslate)}" data-msg-err-input="${esc(t.aiErrInput)}">
<h2>${t.aiPanelTitle}</h2>
<p class="hint">${t.aiPanelLead}</p>
<div class="ai-grid">
  <div class="ai-media-row">
    <label>${t.aiPhotoLabel}<small>${t.aiPhotoHint}</small><input type="file" accept="image/jpeg,image/png,image/webp" data-ai-photo></label>
    <img class="ai-preview" data-ai-photo-preview alt="" hidden>
    <button type="button" class="quiet" data-ai-voice-btn data-label-start="${esc(t.aiVoiceStart)}" data-label-stop="${esc(t.aiVoiceStop)}" data-label-ready="${esc(t.aiVoiceReady)}" hidden>${t.aiVoiceStart}</button>
    <span class="hint" data-ai-voice-status hidden></span>
  </div>
  <label>${t.aiNotesLabel}<textarea data-ai-notes style="min-height:4.5rem" maxlength="12000" placeholder="${esc(t.aiNotesPlaceholder)}"></textarea></label>
  <div class="ai-actions">
    <button type="button" data-ai-extract>${t.aiExtractBtn}</button>
    <button type="button" class="quiet" data-ai-polish>${t.aiPolishBtn}</button>
    <select data-ai-target-lang aria-label="${esc(t.aiTargetLangLabel)}" style="width:auto">${localeOptions(s.locale)}</select>
    <button type="button" class="quiet" data-ai-translate>${t.aiTranslateBtn}</button>
    <button type="button" class="quiet" data-ai-undo hidden>${t.aiUndoBtn}</button>
  </div>
  <div data-ai-status hidden></div>
  <div class="ai-feedback" data-ai-improvements-wrap hidden><h3>${t.aiImprovementsHeading}</h3><ul data-ai-improvements></ul></div>
  <div class="ai-feedback" data-ai-questions-wrap hidden><h3>${t.aiQuestionsHeading}</h3><div data-ai-questions></div></div>
</div></div>`;
  const entry = s.id ? '' : `<div class="panel"><h2>${t.startFaster}</h2>
<form method="post" action="/account/recipes/paste${qs(acctLang)}"><label>${t.pasteLabel}<small>${t.pasteHint}</small><textarea name="text" maxlength="60000"></textarea></label><button class="quiet" type="submit">${t.pasteButton}</button></form>
${importOn ? `<form method="post" action="/account/recipes/import${qs(acctLang)}"><label>${t.importLabel}<small>${t.importHint}</small><input type="url" name="url" maxlength="2000" placeholder="https://"></label><button class="quiet" type="submit">${t.importButton}</button></form>` : `<p class="hint"><strong>${t.importOffName}</strong> ${t.importOffText}</p>`}</div>`;
  const lang = acctLang;
  const ft = FORM_STRINGS[lang]!;
  return `<h1>${s.id ? t.formTitleEdit : t.formTitleNew}</h1><p class="lead">${t.formLead}</p>${note}${errBox}${aiPanel}${entry}
<form method="post" action="/account/recipes/save${qs(acctLang)}" data-capture-form>${s.id ? `<input type="hidden" name="id" value="${esc(s.id)}">` : ''}
<label><span data-category-prompt>${esc(ft.prompt)}</span><select name="category">${categoryOptions(s.category, lang)}</select></label>
<label>${t.labelTitle}<input type="text" name="title" value="${esc(s.title)}" maxlength="200" required></label>
<label>${t.labelLanguage}<select name="locale">${localeOptions(s.locale)}</select></label>
<label><span data-preamble-label>${esc(ft.preamble)}</span> <small data-preamble-hint>${esc(ft.preambleHint)}</small><textarea name="intro" maxlength="2000" style="min-height:4rem">${esc(s.intro)}</textarea></label>
<label>${t.labelIngredients}<small>${t.ingredientsHint}</small><textarea name="ingredients" required>${esc(s.ingredients)}</textarea></label>
<label>${t.labelSteps}<small>${t.stepsHint}</small><textarea name="steps" required>${esc(s.steps)}</textarea></label>
<div class="row"><label>${t.labelPrep}<input type="number" name="prep" min="0" max="20000" value="${esc(s.prep)}"></label><label>${t.labelCook}<input type="number" name="cook" min="0" max="20000" value="${esc(s.cook)}"></label></div>
<label>${t.labelServings} <small>${t.optional}</small><input type="number" name="servings" min="1" max="1000" step="any" value="${esc(s.servings)}"></label>
<label>${t.labelAuthor}<input type="text" name="display_name" value="${esc(s.displayName)}" maxlength="80" required></label>
<label>${t.labelSource}<select name="source_kind"><option value="original"${s.sourceKind === 'original' ? ' selected' : ''}>${t.sourceOriginal}</option><option value="adapted"${s.sourceKind === 'adapted' ? ' selected' : ''}>${t.sourceAdapted}</option></select></label>
<label>${t.labelSourceLink} <small>${t.sourceLinkHint}</small><input type="url" name="source_url" value="${esc(s.sourceUrl)}" maxlength="2000" placeholder="https://"></label>
<label class="check"><input type="checkbox" name="attest" value="1"${s.attest ? ' checked' : ''}><span>${t.attestText}</span></label>
<ul class="live-checks" data-live-checks><li data-check="title"></li><li data-check="ingredients"></li><li data-check="qty"></li><li data-check="cups"></li><li data-check="steps"></li><li data-check="servings"></li><li data-check="source"></li></ul>
<button type="submit">${t.saveDraft}</button></form>${captureDataIslands()}<script>${CAPTURE_CLIENT_SCRIPT}</script>`;
}

export function parseForm(form: Record<string, unknown>, user: { displayName: string | null }): FormState {
  const b = blank(user);
  const sk = str(form['source_kind'], 10) === 'adapted' ? 'adapted' : 'original';
  const loc = str(form['locale'], 10);
  return {
    id: /^[a-z0-9]{6,12}$/.test(str(form['id'], 14)) ? str(form['id'], 14) : undefined,
    title: str(form['title'], 200).trim(), intro: str(form['intro'], 2000).trim(),
    ingredients: str(form['ingredients'], 60000), steps: str(form['steps'], 60000),
    locale: loc.includes(':') ? loc : b.locale,
    category: isRecipeCategorySlug(str(form['category'], 40)) ? str(form['category'], 40) : '',
    prep: str(form['prep'], 8).trim(), cook: str(form['cook'], 8).trim(), servings: str(form['servings'], 8).trim(),
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
  if (s.category) body['category'] = s.category;
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

const rf = (c: Ctx, s: FormState, errors: string[] = [], note = '') => {
  const lang = langOf(c);
  return renderForm(s, accountStrings(lang), lang, errors, note, c.env.IMPORT_ENABLED === 'true');
};

accountApp.get('/recipes/new', (c) => { const t = accountStrings(langOf(c)); return page(c, t.formTitleNew, rf(c, blank(c.get('user')))); });

accountApp.post('/recipes/paste', async (c) => {
  const form = await c.req.parseBody();
  const p = parseRecipeText(str(form['text'], 60000));
  const t = accountStrings(langOf(c));
  const warn = p.warnings.length ? banner('err', p.warnings.map((w) => esc(parseWarningMessage(t, w))).join('<br>')) : banner('ok', t.pasteFilled);
  return page(c, t.formTitleNew, rf(c, fromParsed(blank(c.get('user')), p), [], warn));
});

accountApp.post('/recipes/ai-assist', async (c) => {
  const user = c.get('user');
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_SUBMIT, c, 'ai-assist')) {
    return c.json({ ok: false, error: t.errTooManyTries }, 429, { 'cache-control': 'no-store' });
  }
  let raw: Record<string, unknown>;
  try {
    raw = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ ok: false, error: t.errGeneric }, 400, { 'cache-control': 'no-store' });
  }
  const mode: 'extract' | 'polish' | 'translate' =
    raw['mode'] === 'polish' ? 'polish' : raw['mode'] === 'translate' ? 'translate' : 'extract';
  const uiLang = isAccountLang(raw['uiLang']) ? raw['uiLang'] : (lang as 'en' | 'es' | 'fr');
  const recipeLocale = typeof raw['recipeLocale'] === 'string' && raw['recipeLocale'].includes(':') ? raw['recipeLocale'].slice(0, 12) : 'us:en';
  const targetLocale = typeof raw['targetLocale'] === 'string' && raw['targetLocale'].includes(':') ? raw['targetLocale'].slice(0, 12) : undefined;
  const notes = str(raw['notes'], 12_000).trim();
  const image = sanitizeMediaPart(raw['image'], 'image');
  const audio = sanitizeMediaPart(raw['audio'], 'audio');
  const dRaw = (raw['draft'] && typeof raw['draft'] === 'object' ? raw['draft'] : {}) as Record<string, unknown>;
  const draft = {
    title: str(dRaw['title'], 200).trim(),
    category: isRecipeCategorySlug(str(dRaw['category'], 40)) ? str(dRaw['category'], 40) : '',
    intro: str(dRaw['intro'], 2000).trim(),
    ingredients: Array.isArray(dRaw['ingredients']) ? dRaw['ingredients'].map((x) => str(x, 300).trim()).filter(Boolean).slice(0, 60) : [],
    steps: Array.isArray(dRaw['steps']) ? dRaw['steps'].map((x) => str(x, 800).trim()).filter(Boolean).slice(0, 50) : [],
    prep: str(dRaw['prep'], 8).trim(),
    cook: str(dRaw['cook'], 8).trim(),
    servings: str(dRaw['servings'], 8).trim(),
  };

  if (!image && !audio && !notes && draft.ingredients.length === 0 && draft.steps.length === 0) {
    return c.json({ ok: false, error: t.aiErrInput }, 400, { 'cache-control': 'no-store' });
  }

  const dailyCap = c.env.AI_DAILY_CAP && Number(c.env.AI_DAILY_CAP) > 0 ? Number(c.env.AI_DAILY_CAP) : DEFAULT_AI_DAILY_CAP;
  if (!(await reserveAiBudget(c.env.DB, user.id, mode, dailyCap))) {
    return c.json({ ok: false, error: t.aiErrBusy }, 429, { 'cache-control': 'no-store' });
  }

  const req: AiAssistRequest = { mode, uiLang, recipeLocale, targetLocale, notes, image, audio, draft };
  try {
    const out = await assistRecipe(req, { apiKey: c.env.GEMINI_API_KEY });
    return c.json({ ok: true, ...out }, 200, { 'cache-control': 'no-store' });
  } catch {
    return c.json({ ok: false, error: t.errGeneric }, 503, { 'cache-control': 'no-store' });
  }
});

accountApp.post('/recipes/import', async (c) => {
  const user = c.get('user');
  const t = accountStrings(langOf(c));
  if (c.env.IMPORT_ENABLED !== 'true') return page(c, t.formTitleNew, rf(c, blank(user), [t.errImportOff]), 404);
  if (await limited(c.env.RL_SUBMIT, c, 'import')) return page(c, t.titleSlowDown, rf(c, blank(user), [t.errTooManyImports]), 429);
  const form = await c.req.parseBody();
  const url = str(form['url'], 2000).trim();
  try {
    const { url: finalUrl, text } = await safeFetchText(url);
    const p = parseJsonLdRecipe(text);
    if (!p) return page(c, t.formTitleNew, rf(c, blank(user), [t.errNoRecipeData]), 400);
    const s = { ...fromParsed(blank(user), p), sourceKind: 'adapted' as const, sourceUrl: finalUrl };
    return page(c, t.formTitleNew, rf(c, s, [], banner('ok', fill(t.importFilled, { host: esc(new URL(finalUrl).hostname) }))));
  } catch (e) {
    const msg = e instanceof SsrfError ? ssrfMessage(t, e.message) : t.errReadLink;
    return page(c, t.formTitleNew, rf(c, blank(user), [msg]), 400);
  }
});

accountApp.get('/recipes/:id/edit', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  if (row.r.submittedAt || row.l.status === 'published') return page(c, t.titleSubmitted, banner('ok', t.okAlreadySentEdit), 409);
  const user = c.get('user');
  const ing = (JSON.parse(row.l.ingredientsJson) as unknown[]).map((x) => (typeof x === 'string' ? x : String((x as { name?: string }).name ?? ''))).join('\n');
  const s: FormState = {
    id: row.r.id, title: row.l.title, intro: row.l.intro ?? '', ingredients: ing, steps: (JSON.parse(row.l.stepsJson) as string[]).join('\n'),
    locale: `${row.l.country}:${row.l.lang}`, prep: row.r.prepMinutes?.toString() ?? '', cook: row.r.cookMinutes?.toString() ?? '', servings: row.r.baseServings?.toString() ?? '',
    category: row.r.category ?? '',
    displayName: row.r.authorName ?? user.displayName ?? '', sourceKind: row.s.license === 'user-adapted' ? 'adapted' : 'original', sourceUrl: row.s.license === 'user-adapted' ? row.s.url : '',
    attest: !!row.r.attestedAt,
  };
  const saved = c.req.query('saved') ? banner('ok', t.okSaved) : '';
  const submit = `<form method="post" action="/account/recipes/${esc(row.r.id)}/submit${qs(lang)}"><div class="panel"><h2>${t.submitPanelTitle}</h2><p class="hint">${t.submitPanelHint}${row.r.attestedAt ? '' : t.submitPanelAttestHint}</p><button type="submit"${row.r.attestedAt ? '' : ' disabled'}>${t.submitButton}</button></div></form>
<form method="post" action="/account/recipes/${esc(row.r.id)}/delete${qs(lang)}"><button class="quiet" type="submit">${t.removeDraft}</button></form>`;
  return page(c, t.formTitleEdit, rf(c, s, [], saved) + submit);
});

accountApp.post('/recipes/save', async (c) => {
  const user = c.get('user');
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_SUBMIT, c, 'save')) return page(c, t.titleSlowDown, rf(c, blank(user), [t.errTooManyTries]), 429);
  const form = await c.req.parseBody();
  const s = parseForm(form, user);
  const errors: string[] = [];
  if (!s.displayName) errors.push(t.errAuthorRequired);
  if (s.sourceKind === 'adapted' && !/^https:\/\//.test(s.sourceUrl)) errors.push(t.errAdaptedHttps);
  const [country, recipeLang] = s.locale.split(':');
  if (!country || !recipeLang || !(LOCALES[country] ?? []).includes(recipeLang) || !getCountry(country)) errors.push(t.errPickLanguage);
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  const result = errors.length ? null : validateRecipeSubmission(buildSubmission(s, origin));
  if (result && !result.ok) for (const f of result.errors) errors.push(validatorMessage(t, f.path, f.message));
  if (errors.length || !result || !result.ok) return page(c, t.formTitleNew, rf(c, s, errors), 400);

  const sub = result.value;
  const loc = sub.locales[0]!;
  const D = c.env.DB;
  let id = s.id;
  if (id) {
    const owned = await loadOwned(c, id);
    if (!owned) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
    if (owned.r.submittedAt || owned.l.status === 'published') return page(c, t.titleSubmitted, banner('err', t.errAlreadySent), 409);
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
      D.prepare(`UPDATE recipes SET origin_country = ?, prep_minutes = ?, cook_minutes = ?, base_servings = ?, attested_at = ?, author_name = ?, category = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL`).bind(sub.originCountry ?? null, prep, cook, serv, s.attest ? now : null, s.displayName, s.category || null, id, user.id),
      D.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id),
    ]);
    if (res[1]!.meta.changes !== 1) return page(c, t.titleSubmitted, banner('err', t.errAlreadySentNoSave), 409);
  } else {
    const sourceId = `src-${id}`;
    // The draft-count cap is checked inside the inserts themselves (same transaction), so
    // concurrent creates cannot overshoot it. Nothing is written when the cap is hit.
    const room = "(SELECT count(*) FROM recipes r JOIN recipe_locales l ON l.recipe_id = r.id WHERE r.owner_user_id = ? AND l.status <> 'rejected') < ? AND (SELECT count(*) FROM recipes WHERE owner_user_id = ?) < ?";
    const res = await D.batch([
      D.prepare(`INSERT INTO sources (id,name,url,license,cleared_at,notes) SELECT ?,?,?,?,NULL,? WHERE ${room}`).bind(sourceId, sub.source.name, sub.source.url, sub.source.license, 'user submission - rights review pending', user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
      D.prepare(`INSERT INTO recipes (id,source_id,origin_country,image_key,created_at,prep_minutes,cook_minutes,base_servings,owner_user_id,attested_at,author_name,category) SELECT ?,?,?,NULL,?,?,?,?,?,?,?,? WHERE ${room}`).bind(id, sourceId, sub.originCountry ?? null, now, prep, cook, serv, user.id, s.attest ? now : null, s.displayName, s.category || null, user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
      D.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,intro,ingredients_json,steps_json,status) SELECT ?,?,?,?,?,?,?,?,'draft' WHERE EXISTS (SELECT 1 FROM recipes WHERE id = ?)").bind(id, loc.country, loc.lang, loc.title, slug, loc.intro ?? null, ing, stp, id),
      D.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id),
    ]);
    if (res[1]!.meta.changes !== 1) {
      const life = await D.prepare('SELECT count(*) AS n FROM recipes WHERE owner_user_id = ?').bind(user.id).first<{ n: number }>();
      const msg = (life?.n ?? 0) >= MAX_ROWS_PER_USER
        ? t.errRowLimit
        : fill(t.errDraftLimit, { max: MAX_DRAFTS_PER_USER });
      return page(c, t.formTitleNew, rf(c, s, [msg]), 400);
    }
  }
  return c.redirect(`/account/recipes/${id}/edit?saved=1${qsAmp(lang)}`, 303);
});

accountApp.post('/recipes/:id/submit', async (c) => {
  const user = c.get('user');
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_SUBMIT, c, 'submit')) return page(c, t.titleSlowDown, banner('err', t.errTooManyTries), 429);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  if (row.r.submittedAt || row.l.status === 'published') return page(c, t.titleSubmitted, banner('ok', t.okAlreadySent), 409);
  if (!row.r.attestedAt) return page(c, t.titlePermissionNeeded, banner('err', t.errPermissionNeeded), 409);
  const now = new Date().toISOString();
  const flip = await c.env.DB.prepare('UPDATE recipes SET submitted_at = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND attested_at IS NOT NULL').bind(now, row.r.id, user.id).run();
  if (flip.meta.changes !== 1) return page(c, t.titleSubmitted, banner('ok', t.okAlreadySent), 409);
  // The admin queue (MCP recipes.list submitted:true) is the source of truth; the email is an extra,
  // counted against the same daily mail budget as login codes.
  if (c.env.REVIEW_NOTIFY_TO && (await reserveMail(c.env.DB, 'notice', NOTICES_PER_DAY))) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks recipe submitted for review: ${row.l.title}`.slice(0, 180),
      text: `A recipe was sent in for review.\n\nTitle: ${row.l.title}\nRecipe id: ${row.r.id}\nAuthor shown as: ${row.r.authorName ?? user.displayName ?? ''}\nSubmitter: ${user.email}\nSource: ${row.s.name} (${row.s.url}), license label ${row.s.license}\nAuthor confirmed rights at: ${row.r.attestedAt}\n\nIt stays a private draft until you clear the source and publish it with the admin tools. Queue: MCP recipes.list with submitted:true.\n`,
    }).catch(() => false);
  }
  return page(c, t.sentInPageTitle, `<h1>${t.sentInTitle}</h1><p class="lead">${fill(t.sentInLead, { title: esc(row.l.title) })}</p><p><a class="btn" href="/account${qs(lang)}">${t.backToRecipes}</a></p>`);
});

// --- Community kitchen-test reports ------------------------------------------
// A signed-in cook flags a published recipe as cooked in their kitchen. The
// report is a moderation-queue row only: it changes nothing on the site until
// an admin approves it through the MCP (recipes.moderate_test_report), which
// stamps recipes.tested_at/tested_by. One report per cook per recipe; own
// recipes are excluded (their tested label comes from the submission itself).

const REPORT_NOTE_MAX = 280;
const MAX_REPORT_PHOTO_BYTES = 1_572_864; // 1.5 MB

async function loadReportTarget(c: Ctx, id: string) {
  return c.env.DB.prepare(
    `SELECT r.id AS id, r.owner_user_id AS ownerUserId, l.title AS title
     FROM recipes r JOIN recipe_locales l ON l.recipe_id = r.id AND l.status = 'published'
     WHERE r.id = ? LIMIT 1`,
  ).bind(id).first<{ id: string; ownerUserId: string | null; title: string }>();
}

const reportStatusLabel = (t: AccountStrings, status: string) =>
  status === 'approved' ? t.reportStatusApproved : status === 'rejected' ? t.reportStatusRejected : t.reportStatusPending;

accountApp.get('/recipes/:id/test-report', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const user = c.get('user');
  const row = await loadReportTarget(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errReportNotPublic), 404);
  if (row.ownerUserId === user.id) return page(c, t.reportPageTitle, banner('err', t.errReportOwn), 403);
  const existing = await c.env.DB.prepare('SELECT status FROM recipe_test_reports WHERE recipe_id = ? AND user_id = ?').bind(row.id, user.id).first<{ status: string }>();
  if (existing) return page(c, t.reportPageTitle, `<h1>${t.reportTitle}</h1><p class="lead">${fill(t.reportAlreadyLead, { status: reportStatusLabel(t, existing.status) })}</p>`, 409);
  return page(c, t.reportPageTitle, `<h1>${t.reportTitle}</h1><p class="lead">${fill(t.reportLead, { title: esc(row.title) })}</p>
<form method="post" enctype="multipart/form-data" action="/account/recipes/${esc(row.id)}/test-report${qs(lang)}">
<label>${t.reportNoteLabel}<textarea name="note" rows="3" maxlength="${REPORT_NOTE_MAX}"></textarea></label>
<p class="hint">${t.reportNoteHint}</p>
<label>${t.reportPhotoLabel}<small>${t.reportPhotoHint}</small><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>
<label class="check"><input type="checkbox" name="photo_attest" value="1"> <span>${t.reportPhotoAttestText}</span></label>
<label class="check"><input type="checkbox" name="attest" value="1" required> <span>${t.reportAttestText}</span></label>
<button type="submit">${t.reportButton}</button></form>`);
});

accountApp.post('/recipes/:id/test-report', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const user = c.get('user');
  if (await limited(c.env.RL_SUBMIT, c, 'test-report')) return page(c, t.titleSlowDown, banner('err', t.errTooManyTries), 429);
  const row = await loadReportTarget(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errReportNotPublic), 404);
  if (row.ownerUserId === user.id) return page(c, t.reportPageTitle, banner('err', t.errReportOwn), 403);
  const form = await c.req.parseBody();
  if (form['attest'] !== '1') return page(c, t.reportPageTitle, banner('err', t.errReportAttest), 400);
  const note = str(form['note'], REPORT_NOTE_MAX).trim() || null;

  const existingBefore = await c.env.DB.prepare('SELECT status FROM recipe_test_reports WHERE recipe_id = ? AND user_id = ?').bind(row.id, user.id).first<{ status: string }>();
  if (existingBefore) {
    return page(c, t.reportPageTitle, `<h1>${t.reportTitle}</h1><p class="lead">${fill(t.reportAlreadyLead, { status: reportStatusLabel(t, existingBefore.status) })}</p>`, 409);
  }

  const reportId = newId();
  let imageR2Key: string | null = null;
  let imageMime: string | null = null;
  let imageBytes: number | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;
  const rawPhoto = form['photo'];
  const hasPhoto = Boolean(rawPhoto && typeof rawPhoto === 'object' && 'arrayBuffer' in rawPhoto && Number((rawPhoto as { size?: number }).size) > 0);
  if (hasPhoto) {
    if (form['photo_attest'] !== '1') return page(c, t.reportPageTitle, banner('err', t.errReportPhotoAttest), 400);
    if (!c.env.IMAGES) return page(c, t.reportPageTitle, banner('err', t.errGeneric), 503);
    const photoFile = rawPhoto as File;
    if (photoFile.size > MAX_REPORT_PHOTO_BYTES) return page(c, t.reportPageTitle, banner('err', t.errReportPhotoInvalid), 400);
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const info = bytes.length <= MAX_REPORT_PHOTO_BYTES ? await validateImage(bytes) : null;
    if (!info) return page(c, t.reportPageTitle, banner('err', t.errReportPhotoInvalid), 400);
    imageR2Key = `reports/${row.id}/${reportId}.${info.ext}`;
    imageMime = info.mime;
    imageBytes = bytes.length;
    imageWidth = info.width;
    imageHeight = info.height;
    // Pending/rejected photos live only under reports/ in R2 and are NEVER in recipe_images,
    // so /img/recipe/* cannot serve them unless a moderator approves via MCP.
    await c.env.IMAGES.put(imageR2Key, bytes, { httpMetadata: { contentType: info.mime } });
  }

  const now = new Date().toISOString();
  // The duplicate guard lives inside the INSERT (single statement) so two
  // concurrent posts cannot both land; the unique index is the backstop.
  const ins = await c.env.DB.prepare(
    `INSERT INTO recipe_test_reports (id, recipe_id, user_id, note, status, created_at, image_r2_key, image_mime, image_bytes, image_width, image_height)
     SELECT ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM recipe_test_reports WHERE recipe_id = ? AND user_id = ?)`,
  ).bind(reportId, row.id, user.id, note, now, imageR2Key, imageMime, imageBytes, imageWidth, imageHeight, row.id, user.id).run();
  if (ins.meta.changes !== 1) {
    const existing = await c.env.DB.prepare('SELECT status FROM recipe_test_reports WHERE recipe_id = ? AND user_id = ?').bind(row.id, user.id).first<{ status: string }>();
    return page(c, t.reportPageTitle, `<h1>${t.reportTitle}</h1><p class="lead">${fill(t.reportAlreadyLead, { status: reportStatusLabel(t, existing?.status ?? 'pending') })}</p>`, 409);
  }
  // The MCP queue (recipes.list_test_reports) is the source of truth; the email is an extra,
  // counted against the same daily notice budget as recipe submissions.
  if (c.env.REVIEW_NOTIFY_TO && (await reserveMail(c.env.DB, 'notice', NOTICES_PER_DAY))) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks kitchen-test report: ${row.title}`.slice(0, 180),
      text: `A cook reports testing a recipe in their kitchen.\n\nTitle: ${row.title}\nRecipe id: ${row.id}\nCook: ${user.displayName ?? ''} <${user.email}>\nNote: ${note ?? '(none)'}\nPhoto attached: ${imageR2Key ? `yes (${imageMime}, ${imageWidth}x${imageHeight})` : 'no'}\n\nThe tested label changes only if you approve the report. Queue: MCP recipes.list_test_reports with status pending.\n`,
    }).catch(() => false);
  }
  return page(c, t.reportSentPageTitle, `<h1>${t.reportSentTitle}</h1><p class="lead">${fill(t.reportSentLead, { title: esc(row.title) })}</p><p><a class="btn" href="/account${qs(lang)}">${t.backToRecipes}</a></p>`);
});

// "Remove" never deletes data: the locale is marked rejected (hidden from the owner's list), rows stay for review/audit.
accountApp.post('/recipes/:id/delete', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    "UPDATE recipe_locales SET status = 'rejected' WHERE recipe_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL)",
  ).bind(id, id, user.id).run();
  if (r.meta.changes !== 1) return page(c, accountStrings(langOf(c)).titleNotFound, banner('err', accountStrings(langOf(c)).errDraftNotFoundOrSent), 404);
  return c.redirect(`/account${qs(langOf(c))}`, 303);
});
