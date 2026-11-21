// Accounts (email-code sign-in) and user-owned private recipe drafts.
// Everything here is server-rendered HTML + plain form posts (no client JS).
// Publication is NOT possible from this module: a submit only flags the draft
// for review; an admin publishes through the MCP after rights clearance.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq, and, ne, desc, isNull, or } from 'drizzle-orm';
import { LOCALES, getCountry, localizedCountryName, slugify, recipePathFor, validateRecipeSubmission, RECIPE_CATEGORY_SLUGS, categoryLabel, isRecipeCategorySlug, CATEGORIES, accountStrings, fill, isAccountLang, validatorMessage, parseWarningMessage, ssrfMessage, MAX_RECIPE_LINES, sanitizeSearchGapPrompt, titleCasePrompt, searchCatalog, renderIngredient, renderStep, defaultUnitSystem, type AccountStrings, type IngredientEntry, type SearchableRecipe } from '@2yolks/contracts';
import { renderAccountPage, escapeHtml as esc, CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS, DRAFT_PHOTO_CLIENT_SCRIPT, ACCOUNT_LIVE_SHARE_SCRIPT, PASSKEY_CLIENT_SCRIPT } from '@2yolks/web/server';
import { createDb, hasUserSharedRecipe, recipes, recipeLocales, sources, users } from './db';
import { sendMail, type MailEnv } from './email';
import { googleOAuthEnabled, loadUserPasskeys, registerAuthMethodRoutes } from './authMethods';
import { parseRecipeText, parseJsonLdRecipe, type ParsedRecipe } from './parse';
import { safeFetchText, SsrfError } from './ssrf';
import { assistRecipe, aiUnavailableReason, AiUnavailableError, reserveAiBudget, sanitizeMediaPart, DEFAULT_AI_DAILY_CAP, type AiAssistRequest } from './aiRecipe';
import { validateImage } from './imageValidation';
import {
  build2YolksZelutoLinks,
  get2YolksCreatorRegistrationStatus,
  push2YolksContactToZeluto,
  request2YolksCreatorRegistration,
  type Zeluto2YolksConfig,
  type ZelutoConnectionStatus,
} from './zeluto';
import {
  renderDraftPhotoField,
  extractUploadedPhoto,
  wantsRemovePhoto,
  activeDraftPhoto,
  prepareDraftPhoto,
  commitDraftPhoto,
  deleteDraftPhoto,
  photoErrorMessage,
  type ValidatedDraftPhoto,
} from './draftPhotos';

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
  /**
   * Optional override for the site-wide daily sign-in code budget (positive
   * integer, clamped to MAX_CODES_PER_DAY; anything else falls back to
   * CODES_PER_DAY = 80). Stays bounded inside the Resend free tier
   * (100/day) alongside NOTICES_PER_DAY (80 + 8 = 88/day default ceiling).
   */
  CODES_PER_DAY?: string;
  /** Optional Workers rate-limit bindings (approximate, per location). Absent = skipped. */
  RL_AUTH?: RateLimiter;
  RL_SUBMIT?: RateLimiter;
  ALLOW_DEMO_SEED?: string;
  ZELUTO_URL?: string;
  ZELUTO_CLIENT_SECRET?: string;
  ZELUTO_SYNC_SECRET?: string;
  ZELUTO_BRAND_ORG_ID?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export const SESSION_COOKIE = '__Host-2y_sid';
export const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const CODES_PER_EMAIL_10MIN = 3;
export const CODES_PER_DAY = 80; // default login codes per rolling 24h, counted by kind (inside Resend's 100/day tier)
export const MAX_CODES_PER_DAY = 1000; // ceiling for the CODES_PER_DAY env override
export const NOTICES_PER_DAY = 8; // review notices per rolling 24h, counted by kind; 80 + 8 = 88/day hard total at the default code budget
export const MAX_DRAFTS_PER_USER = 50; // active (not removed) drafts
export const MAX_ROWS_PER_USER = 500; // lifetime rows incl. removed ones, so remove/recreate loops cannot grow storage forever
export const MAX_SAVED_PER_USER = 200; // max saved (bookmarked) recipes per account

export type AccountUser = { id: string; email: string; displayName: string | null };
export const accountApp = new Hono<{ Bindings: AccountBindings; Variables: { user: AccountUser | null } }>();
type Ctx = Context<{ Bindings: AccountBindings; Variables: { user: AccountUser | null } }>;

/** Site-wide daily sign-in code budget: CODES_PER_DAY env override (positive integer, clamped) or the default 80. */
export function codesPerDay(env: { CODES_PER_DAY?: string }): number {
  const raw = typeof env.CODES_PER_DAY === 'string' ? env.CODES_PER_DAY.trim() : '';
  if (!/^\d{1,9}$/.test(raw)) return CODES_PER_DAY;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, MAX_CODES_PER_DAY) : CODES_PER_DAY;
}

// The whole account UI is localized en/es/fr. The language travels as ?lang=
// on every link, form action and redirect (English default keeps bare URLs).
const langOf = (c: Ctx): string => { const l = c.req.query('lang'); return isAccountLang(l) ? l : 'en'; };
const qs = (lang: string): string => (lang === 'en' ? '' : `?lang=${lang}`);
const qsAmp = (lang: string): string => (lang === 'en' ? '' : `&lang=${lang}`);

function zelutoConfigFromCtx(c: Ctx): Zeluto2YolksConfig {
  return {
    zelutoUrl: c.env.ZELUTO_URL,
    clientSecret: c.env.ZELUTO_CLIENT_SECRET,
    syncSecret: c.env.ZELUTO_SYNC_SECRET,
    brandOrgId: c.env.ZELUTO_BRAND_ORG_ID,
  };
}

/**
 * Return-to target after sign-in (`?next=`), or null. Strict on purpose: only
 * '/account' or a same-origin relative PATH under /account/ (no query, no fragment),
 * built from unreserved characters, without dot segments, doubled slashes,
 * backslashes, percent-escapes, a scheme or control characters, and short.
 * Anything else is dropped (the user lands on /account instead), so it can
 * never become an open redirect.
 */
export const MAX_NEXT_PATH = 160;
export function safeNextPath(raw: unknown): string | null {
  if (raw === '/account' || raw === '/saved') return raw;
  if (typeof raw !== 'string' || raw.length < 10 || raw.length > MAX_NEXT_PATH) return null;
  if (!raw.startsWith('/account/')) return null;
  if (!/^\/account\/[A-Za-z0-9_\-/]+$/.test(raw)) return null; // also rules out \, %, :, ?, #, ., whitespace
  if (raw.includes('//')) return null;
  try {
    const u = new URL(raw, 'https://next.invalid');
    if (u.origin !== 'https://next.invalid' || u.pathname !== raw) return null;
  } catch { return null; }
  return raw;
}
/** `?lang=..&next=..` / `?next=..` / `?lang=..` / '' for form actions and links. */
const qsNext = (lang: string, next: string | null): string => {
  const parts = [...(lang === 'en' ? [] : [`lang=${lang}`]), ...(next ? [`next=${encodeURIComponent(next)}`] : [])];
  return parts.length ? `?${parts.join('&')}` : '';
};
/** fetch() callers (the inline sign-in step, in-page paste) ask for JSON. */
const wantsJson = (c: Ctx): boolean => /\bapplication\/json\b/i.test(c.req.header('accept') ?? '');
const NO_STORE = { 'cache-control': 'no-store' } as const;

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

function page(c: Ctx, title: string, body: string, status: 200 | 400 | 403 | 404 | 409 | 429 | 503 = 200, nextOverride?: string | null, wide = false) {
  const lang = langOf(c);
  const next = nextOverride !== undefined ? nextOverride : safeNextPath(c.req.query('next'));
  return c.html(renderAccountPage(title, body, lang, new URL(c.req.url).pathname, next, { wide }), status, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
}
const banner = (kind: 'err' | 'ok', msg: string) => `<div class="${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${msg}</div>`;
async function readBody(c: Ctx): Promise<Record<string, unknown>> {
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      const parsed = await c.req.json();
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch { return {}; }
  }
  return (await c.req.parseBody()) as Record<string, unknown>;
}

// --- CSRF: SameSite=Lax cookie plus an Origin check on every mutating request.
accountApp.use('*', async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('origin');
    const allowed = new Set([new URL(c.req.url).origin]);
    if (c.env.CANONICAL_ORIGIN) allowed.add(c.env.CANONICAL_ORIGIN);
    if (!origin || !allowed.has(origin)) {
      const t = accountStrings(langOf(c));
      if (wantsJson(c)) return c.json({ ok: false, error: t.errBlocked }, 403, NO_STORE);
      return page(c, t.titleBlocked, banner('err', t.errBlocked), 403);
    }
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

/** Drop expired sign-in artifacts only (codes, sessions, challenges, old mail counters). Never touches recipes or users. */
export async function cleanupExpired(db: D1Database, now: number): Promise<void> {
  try {
    await db.batch([
      db.prepare('DELETE FROM auth_codes WHERE expires_at < ?').bind(now - 86_400_000),
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM mail_log WHERE created_at < ?').bind(now - 2 * 86_400_000),
    ]);
    await db.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').bind(now).run();
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
const photoBodyLimit = bodyLimit({
  maxSize: 4 * 1024 * 1024,
  onError: (c) => {
    const lang = langOf(c as Ctx);
    const t = accountStrings(lang);
    if (wantsJson(c as Ctx)) return c.json({ ok: false, error: t.errTooLarge }, 413, NO_STORE);
    return c.html(renderAccountPage(t.titleTooLarge, `<div class="err" role="alert">${t.errTooLarge}</div>`, lang, new URL(c.req.url).pathname), 413);
  },
});
accountApp.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.endsWith('/recipes/ai-assist')) return aiBodyLimit(c, next);
  if (path.endsWith('/test-report')) return reportBodyLimit(c, next);
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (ct.startsWith('multipart/form-data') && (path.endsWith('/recipes/save') || /\/recipes\/[^/]+\/photo$/.test(path))) {
    return photoBodyLimit(c, next);
  }
  return standardBodyLimit(c, next);
});

export async function limited(
  rl: RateLimiter | undefined,
  c: { req: { header(name: string): string | undefined } },
  scope: string,
): Promise<boolean> {
  if (!rl) return false;
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  try { return !(await rl.limit({ key: `${scope}:${ip}` })).success; } catch { return false; }
}

export async function readSessionUser(db: D1Database, cookieToken: string | undefined): Promise<AccountUser | null> {
  if (!cookieToken || !/^[0-9a-f]{64}$/.test(cookieToken)) return null;
  const id = await sha256Hex(cookieToken);
  const row = await db.prepare(
    'SELECT u.id AS id, u.email AS email, u.display_name AS displayName FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
  ).bind(id, Date.now()).first<{ id: string; email: string; displayName: string | null }>();
  return row ?? null;
}

export async function loadSavedRecipeIds(db: D1Database, userId: string): Promise<string[]> {
  try {
    const res = await db
      .prepare('SELECT recipe_id FROM saved_recipes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(userId, MAX_SAVED_PER_USER)
      .all<{ recipe_id: string }>();
    return (res.results ?? []).map((r) => String(r.recipe_id));
  } catch {
    return [];
  }
}

async function currentUser(c: Ctx) {
  return readSessionUser(c.env.DB, getCookie(c, SESSION_COOKIE));
}

accountApp.use('*', async (c, next) => {
  const u = await currentUser(c);
  c.set('user', u);
  await next();
});

// --- Views -------------------------------------------------------------------

const nextField = (next: string | null) => (next ? `<input type="hidden" name="next" value="${esc(next)}">` : '');

const signInForm = (t: AccountStrings, lang: string, msg = '', next: string | null = null, googleEnabled = false) => {
  const gHref = `/account/google/start${qsNext(lang, next)}`;
  const altAuth = `<div class="alt-auth" data-alt-auth${googleEnabled ? '' : ' hidden'}>
<div class="alt-auth-actions">
  <button type="button" class="quiet btn-passkey" data-passkey-login hidden data-options-url="/account/passkey/login/options${qs(lang)}" data-verify-url="/account/passkey/login/verify${qs(lang)}" data-next="${esc(next ?? '')}" data-msg-working="${esc(t.authWorking)}" data-msg-cancel="${esc(t.errPasskeyCancelled)}" data-msg-fail="${esc(t.errPasskeyFailed)}">${t.passkeySignInBtn}</button>
  ${googleEnabled ? `<a class="btn-google" data-google-login href="${esc(gHref)}">${t.googleSignInBtn}</a>` : ''}
</div>
<div data-passkey-status role="status" aria-live="polite" hidden></div>
<div class="auth-divider"><span>${t.orDivider}</span></div>
</div>`;
  return `<h1>${t.signInTitle}</h1>
<p class="lead">${t.signInLead}</p>${msg}
${altAuth}
<form method="post" action="/account/code${qsNext(lang, next)}">${nextField(next)}<label>${t.signInEmailLabel}<input type="email" name="email" required autocomplete="email" maxlength="254"></label><button type="submit">${t.signInButton}</button></form>
<p class="hint">${t.signInHint}</p><script>${PASSKEY_CLIENT_SCRIPT}</script>`;
};

const codeForm = (t: AccountStrings, lang: string, email: string, msg = '', next: string | null = null) => `<h1>${t.codeTitle}</h1>
<p class="lead">${fill(t.codeLead, { email: esc(email) })}</p>${msg}
<form method="post" action="/account/verify${qsNext(lang, next)}">${nextField(next)}<input type="hidden" name="email" value="${esc(email)}"><label>${t.codeLabel}<input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" required></label><button type="submit">${t.codeButton}</button></form>`;

type RecipeLifecycle = 'draft' | 'in_review' | 'needs_changes' | 'declined' | 'published';

function recipeLifecycle(r: { status: string; reviewStatus: string | null; submittedAt: string | null }): RecipeLifecycle {
  if (r.status === 'published' || r.reviewStatus === 'published') return 'published';
  if (r.reviewStatus === 'declined') return 'declined';
  if (r.reviewStatus === 'needs_changes') return 'needs_changes';
  if (r.submittedAt || r.reviewStatus === 'in_review') return 'in_review';
  return 'draft';
}

function renderTimeline(t: AccountStrings, state: RecipeLifecycle): string {
  const step = (cls: string, label: string, current = false) =>
    `<li class="status-step ${cls}"${current ? ' aria-current="step"' : ''}>${label}</li>`;
  if (state === 'draft') {
    return `<ol class="status-timeline">${step('is-current', t.timelineDraft, true)}${step('is-pending', t.timelineReview)}${step('is-pending', t.timelineLive)}</ol>`;
  }
  if (state === 'in_review') {
    return `<ol class="status-timeline">${step('is-done', t.timelineDraft)}${step('is-current', t.timelineReview, true)}${step('is-pending', t.timelineLive)}</ol>`;
  }
  if (state === 'needs_changes') {
    return `<ol class="status-timeline">${step('is-done', t.timelineDraft)}${step('is-attention', t.timelineReview, true)}${step('is-pending', t.timelineLive)}</ol>`;
  }
  if (state === 'declined') {
    return `<ol class="status-timeline">${step('is-done', t.timelineDraft)}${step('is-declined', t.timelineReview, true)}${step('is-pending', t.timelineLive)}</ol>`;
  }
  return `<ol class="status-timeline">${step('is-done', t.timelineDraft)}${step('is-done', t.timelineReview)}${step('is-done', t.timelineLive, true)}</ol>`;
}

const copyDeclinedForm = (t: AccountStrings, lang: string, id: string) =>
  `<form method="post" action="/account/recipes/${esc(id)}/copy${qs(lang)}" class="actions"><button type="submit" class="quiet">${t.makeCopy}</button></form>`;

function rawLineCount(v: string): number {
  return v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
}

/** Load sanitized top zero-result search queries from search_gap_logs (tolerating sparse D1 schemas). */
export async function loadTopSearchGaps(
  db: D1Database,
  lang: string,
  limit = 4,
  excludeSatisfiedBy?: readonly SearchableRecipe[],
): Promise<string[]> {
  if (limit <= 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const acceptRows = (rows: ReadonlyArray<{ query?: unknown }>) => {
    for (const row of rows) {
      const clean = sanitizeSearchGapPrompt(row?.query);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      if (excludeSatisfiedBy && excludeSatisfiedBy.length > 0 && searchCatalog(excludeSatisfiedBy, { q: clean, pageSize: 1 }, lang).total > 0) {
        continue;
      }
      seen.add(key);
      out.push(clean);
      if (out.length >= limit) break;
    }
  };
  try {
    const localRows = await db
      .prepare('SELECT query, COUNT(*) AS cnt, MAX(created_at) AS latest FROM search_gap_logs WHERE locale = ? GROUP BY lower(trim(query)) ORDER BY cnt DESC, latest DESC LIMIT 30')
      .bind(lang)
      .all<{ query: string }>();
    acceptRows(localRows.results ?? []);
    if (out.length < limit) {
      const anyRows = await db
        .prepare('SELECT query, COUNT(*) AS cnt, MAX(created_at) AS latest FROM search_gap_logs GROUP BY lower(trim(query)) ORDER BY cnt DESC, latest DESC LIMIT 30')
        .all<{ query: string }>();
      acceptRows(anyRows.results ?? []);
    }
  } catch { /* tolerate sparse test DBs lacking migration 0007 */ }
  return out;
}

accountApp.get('/', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const next = safeNextPath(c.req.query('next'));
  const user = c.get('user');
  if (!user) return page(c, t.signInPageTitle, signInForm(t, lang, '', next, googleOAuthEnabled(c.env)), 200, next);
  if (next && next !== '/account') return c.redirect(`${next}${qs(lang)}`, 303);
  const db = createDb(c.env.DB);
  const origin = (c.env.CANONICAL_ORIGIN || new URL(c.req.url).origin).replace(/\/+$/, '');
  const rawRows = await db.select({
    id: recipes.id,
    submittedAt: recipes.submittedAt,
    reviewStatus: recipes.reviewStatus,
    reviewNote: recipes.reviewNote,
    title: recipeLocales.title,
    country: recipeLocales.country,
    lang: recipeLocales.lang,
    slug: recipeLocales.slug,
    status: recipeLocales.status,
  })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id))
    .where(and(
      eq(recipes.ownerUserId, user.id),
      isNull(recipes.removedByUserAt),
      or(ne(recipeLocales.status, 'rejected'), eq(recipes.reviewStatus, 'declined')),
    ))
    .orderBy(desc(recipes.createdAt));

  // Deduplicate multi-locale recipes cleanly: prefer published locale, then active UI lang, else first row.
  const byId = new Map<string, typeof rawRows[number]>();
  for (const row of rawRows) {
    const cur = byId.get(row.id);
    if (!cur) { byId.set(row.id, row); continue; }
    if (cur.status !== 'published' && (row.status === 'published' || (row.lang === lang && cur.lang !== lang))) {
      byId.set(row.id, row);
    }
  }

  let hasLiveRecipe = false;
  const items = [...byId.values()].map((r) => {
    const state = recipeLifecycle(r);
    const badgeCls =
      state === 'published' ? 'badge--live'
      : state === 'declined' ? 'badge--declined'
      : state === 'needs_changes' ? 'badge--changes'
      : state === 'in_review' ? 'badge--review'
      : 'badge--draft';
    const label =
      state === 'published' ? t.statusPublished
      : state === 'declined' ? t.statusDeclined
      : state === 'needs_changes' ? t.statusNeedsChanges
      : state === 'in_review' ? t.statusSubmitted
      : t.statusDraft;
    const livePath = recipePathFor(r.country, r.lang, r.slug);
    const liveUrl = `${origin}${livePath}`;
    if (state === 'published') hasLiveRecipe = true;
    const celebration = state === 'published'
      ? `<div class="live-celebration" data-live-celebration><strong>${esc(t.celebrateLiveTitle)}</strong><span>${esc(t.celebrateLiveLead)}</span><div class="live-celebration-actions"><button type="button" class="quiet" data-acct-story-card data-card-svg="${esc(`${livePath}/card.svg`)}" data-recipe-slug="${esc(r.slug)}" data-live-url="${esc(liveUrl)}" data-copied="${esc(t.celebrateStoryReady)}">${esc(t.celebrateStoryBtn)}</button><button type="button" class="quiet" data-acct-copy-url="${esc(liveUrl)}" data-copied="${esc(t.celebrateLinkCopied)}">${esc(t.celebrateCopyBtn)}</button><a class="btn-quiet" href="https://wa.me/?text=${encodeURIComponent(`${r.title} — ${liveUrl}`)}" target="_blank" rel="noopener noreferrer">${esc(t.celebrateWhatsApp)}</a></div></div>`
      : '';
    const note =
      (state === 'needs_changes' || state === 'declined') && r.reviewNote
        ? `<p class="review-note${state === 'declined' ? ' review-note--declined' : ''}">${esc(r.reviewNote)}</p>`
        : state === 'in_review'
          ? `<p class="hint">${t.inReviewNote}</p>`
          : celebration;
    const action =
      state === 'published' ? `<a href="${esc(livePath)}">${t.viewLiveRecipe}</a>`
      : state === 'declined' ? copyDeclinedForm(t, lang, r.id)
      : state === 'needs_changes' ? `<a href="/account/recipes/${esc(r.id)}/edit${qs(lang)}">${t.editAndResend}</a>`
      : state === 'in_review' ? ''
      : `<a href="/account/recipes/${esc(r.id)}/edit${qs(lang)}">${t.editLink}</a>`;
    return `<li><div class="mine-main"><strong>${esc(r.title)}</strong> <span class="badge ${badgeCls}">${label}</span>${renderTimeline(t, state)}${note}</div><div class="mine-actions">${action}</div></li>`;
  }).join('');
  const isCreator = await hasUserSharedRecipe(c.env.DB, user.id);
  const [savedIds, passkeys] = await Promise.all([loadSavedRecipeIds(c.env.DB, user.id), loadUserPasskeys(c.env.DB, user.id)]);
  const passkeyNotice = c.req.query('passkey_added') === '1' ? banner('ok', t.passkeyAddedMsg) : '';
  const passkeyItems = passkeys
    .map(
      (pk) =>
        `<li><div class="mine-main"><strong>${esc(pk.label)}</strong><p class="hint">${esc((pk.lastUsedAt ?? pk.createdAt).slice(0, 10))}</p></div><div class="mine-actions"><form method="post" action="/account/passkey/${esc(pk.id)}/delete${qs(lang)}"><button type="submit" class="quiet">${t.passkeyRemoveBtn}</button></form></div></li>`,
    )
    .join('');
  const passkeyPanel = `<div class="panel" data-passkeys-panel><h2>${t.passkeysPanelTitle}</h2><p class="hint">${t.passkeysPanelLead}</p>${passkeyItems ? `<ul class="mine passkey-list">${passkeyItems}</ul>` : `<p class="hint">${t.passkeysEmpty}</p>`}<p><button type="button" class="quiet" data-passkey-register hidden data-options-url="/account/passkey/register/options${qs(lang)}" data-verify-url="/account/passkey/register/verify${qs(lang)}" data-msg-working="${esc(t.authWorking)}" data-msg-unsupported="${esc(t.errPasskeyUnsupported)}" data-msg-cancel="${esc(t.errPasskeyCancelled)}" data-msg-fail="${esc(t.errPasskeyFailed)}">${t.passkeyAddBtn}</button></p><div data-passkey-reg-status role="status" aria-live="polite" hidden></div></div>`;
  const savedPanel = `<div class="panel"><h2>${t.savedPanelTitle}</h2><p>${fill(t.savedPanelLead, { count: savedIds.length })}</p><p><a class="btn" href="/saved${qs(lang)}">${t.savedPanelLink}</a></p></div>`;
  const creatorSection = isCreator
    ? `<div class="panel"><h2>Creator Subscribers &amp; Zeluto CRM</h2><p>Because you shared a recipe, your Creator workspace is unlocked.</p><p><a class="btn" href="/account/subscribers${qs(lang)}">Manage Subscribers &amp; Zeluto CRM</a></p></div>`
    : '';
  return page(c, t.homePageTitle, `<h1>${t.homeTitle}</h1><p class="lead">${fill(t.homeLead, { email: esc(user.email) })}</p>${passkeyNotice}
<p><a class="btn" href="/account/recipes/new${qs(lang)}">${t.addRecipe}</a></p>
${savedPanel}
${passkeyPanel}
${creatorSection}
<div class="panel"><h2>${t.yourDrafts}</h2>${items ? `<ul class="mine">${items}</ul>` : `<p class="hint">${t.emptyDrafts}</p>`}</div>
<form method="post" action="/account/logout${qs(lang)}"><button class="quiet" type="submit">${t.signOut}</button></form><script>${PASSKEY_CLIENT_SCRIPT}</script>${hasLiveRecipe ? `<script>${ACCOUNT_LIVE_SHARE_SCRIPT}</script>` : ''}`);
});

// --- Saved recipes (bookmarks) -----------------------------------------------

async function isPublishedRecipeId(db: D1Database, recipeId: string, allowDemo: boolean): Promise<boolean> {
  const demoFilter = allowDemo ? '' : "AND s.license != 'internal-demo'";
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM recipe_locales l JOIN recipes r ON r.id = l.recipe_id JOIN sources s ON s.id = r.source_id WHERE r.id = ? AND l.status = 'published' AND s.cleared_at IS NOT NULL ${demoFilter} LIMIT 1`,
    )
    .bind(recipeId)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

accountApp.get('/saved', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: true, signedIn: false, ids: [] }, 200, NO_STORE);
  const ids = await loadSavedRecipeIds(c.env.DB, user.id);
  return c.json({ ok: true, signedIn: true, ids }, 200, NO_STORE);
});

accountApp.post('/saved/toggle', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const json = wantsJson(c);
  const user = c.get('user');
  if (!user) {
    if (json) return c.json({ ok: false, signedIn: false, error: t.signInPageTitle }, 401, NO_STORE);
    return c.redirect(`/account${qsNext(lang, '/saved')}`, 303);
  }
  const body = await readBody(c);
  const recipeId = str(body['recipe_id'], 40).trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(recipeId)) {
    if (json) return c.json({ ok: false, error: t.errGeneric }, 400, NO_STORE);
    return c.redirect(`/saved${qs(lang)}`, 303);
  }
  const existing = await c.env.DB
    .prepare('SELECT 1 AS ok FROM saved_recipes WHERE user_id = ? AND recipe_id = ? LIMIT 1')
    .bind(user.id, recipeId)
    .first<{ ok: number }>();
  let saved = false;
  if (existing?.ok === 1) {
    await c.env.DB.prepare('DELETE FROM saved_recipes WHERE user_id = ? AND recipe_id = ?').bind(user.id, recipeId).run();
    saved = false;
  } else {
    const pub = await isPublishedRecipeId(c.env.DB, recipeId, c.env.ALLOW_DEMO_SEED === 'true');
    if (!pub) {
      if (json) return c.json({ ok: false, error: t.titleNotFound }, 404, NO_STORE);
      return c.redirect(`/saved${qs(lang)}`, 303);
    }
    const cnt = await c.env.DB.prepare('SELECT count(*) AS n FROM saved_recipes WHERE user_id = ?').bind(user.id).first<{ n: number }>();
    if ((cnt?.n ?? 0) >= MAX_SAVED_PER_USER) {
      if (json) return c.json({ ok: false, error: t.errRowLimit }, 400, NO_STORE);
      return c.redirect(`/saved${qs(lang)}`, 303);
    }
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO saved_recipes (user_id, recipe_id, created_at) VALUES (?, ?, ?)')
      .bind(user.id, recipeId, new Date().toISOString())
      .run();
    saved = true;
  }
  const ids = await loadSavedRecipeIds(c.env.DB, user.id);
  if (json) return c.json({ ok: true, saved, recipeId, ids }, 200, NO_STORE);
  return c.redirect(`/saved${qs(lang)}`, 303);
});

accountApp.post('/saved/sync', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: false, signedIn: false }, 401, NO_STORE);
  const body = await readBody(c);
  const rawIds = Array.isArray(body['ids']) ? body['ids'] : [];
  const cleanIds: string[] = [];
  for (const item of rawIds) {
    if (typeof item === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(item) && !cleanIds.includes(item)) {
      cleanIds.push(item);
      if (cleanIds.length >= MAX_SAVED_PER_USER) break;
    }
  }
  const current = await loadSavedRecipeIds(c.env.DB, user.id);
  const existingSet = new Set(current);
  let remaining = Math.max(0, MAX_SAVED_PER_USER - current.length);
  const nowIso = new Date().toISOString();
  const allowDemo = c.env.ALLOW_DEMO_SEED === 'true';
  for (const rid of cleanIds) {
    if (remaining <= 0) break;
    if (existingSet.has(rid)) continue;
    if (!(await isPublishedRecipeId(c.env.DB, rid, allowDemo))) continue;
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO saved_recipes (user_id, recipe_id, created_at) VALUES (?, ?, ?)')
      .bind(user.id, rid, nowIso)
      .run();
    existingSet.add(rid);
    remaining--;
  }
  const ids = await loadSavedRecipeIds(c.env.DB, user.id);
  return c.json({ ok: true, ids }, 200, NO_STORE);
});

accountApp.post('/code', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const queryNext = safeNextPath(c.req.query('next'));
  const json = wantsJson(c);
  const fail = (status: 400 | 429 | 503, pageTitle: string, msg: string, next = queryNext) =>
    json ? c.json({ ok: false, error: msg }, status, NO_STORE) : page(c, pageTitle, signInForm(t, lang, banner('err', msg), next, googleOAuthEnabled(c.env)), status, next);
  if (await limited(c.env.RL_AUTH, c, 'code')) return fail(429, t.titleSlowDown, t.errTooManyTries);
  const form = await readBody(c);
  const next = safeNextPath(form['next']) ?? queryNext;
  const email = normEmail(form['email']);
  if (!email) return fail(400, t.signInPageTitle, t.errInvalidEmail, next);
  if (!c.env.RESEND_API_KEY) return fail(503, t.signInPageTitle, t.errSigninOff, next);
  const now = Date.now();
  await cleanupExpired(c.env.DB, now);
  const code = randomCode();
  const id = newId();
  // Per-email budget first (atomic INSERT ... SELECT ... WHERE count<3) so rejected retries never spend site budget.
  const ins = await c.env.DB.prepare(
    'INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,used,created_at) SELECT ?,?,?,?,0,0,? WHERE (SELECT count(*) FROM auth_codes WHERE email = ? AND created_at > ?) < ?',
  ).bind(id, email, await sha256Hex(`${email}:${code}`), now + CODE_TTL_MS, now, email, now - CODE_TTL_MS, CODES_PER_EMAIL_10MIN).run();
  if (ins.meta.changes !== 1) return fail(429, t.titleSlowDown, t.errTooManyCodes, next);
  // Then the site-wide daily mail budget (atomic conditional INSERT). No budget: the code is never sent, so kill it.
  if (!(await reserveMail(c.env.DB, 'code', codesPerDay(c.env)))) {
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return fail(503, t.titleBusy, t.errBusy, next);
  }
  // Only the newest code stays valid. Order by insertion (rowid), so a concurrently issued newer code is never invalidated by an older request.
  await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE email = ? AND used = 0 AND rowid < (SELECT rowid FROM auth_codes WHERE id = ?)').bind(email, id).run();
  const sent = await sendMail(c.env, { to: email, subject: fill(t.mailSubject, { code }), text: fill(t.mailBody, { code }) });
  if (!sent) {
    // No refund: delivery state is ambiguous, so the budget slot and per-email slot stay used. Invalidate the code.
    await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(id).run();
    return fail(503, t.signInPageTitle, t.errSendFailed, next);
  }
  if (json) return c.json({ ok: true, email }, 200, NO_STORE);
  return page(c, t.codePageTitle, codeForm(t, lang, email, '', next), 200, next);
});

async function issueUserSession(
  c: Ctx,
  user: { id: string; email: string },
  next: string | null,
  lang: string,
  json: boolean,
): Promise<Response> {
  const now = Date.now();
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), user.id, now + SESSION_DAYS * 86_400_000, now).run();
  if (c.env.ZELUTO_CLIENT_SECRET?.trim()) {
    const isCreator = await hasUserSharedRecipe(c.env.DB, user.id);
    const pushRes = await push2YolksContactToZeluto(zelutoConfigFromCtx(c), {
      email: user.email,
      externalId: user.id,
      externalEntityType: 'user',
      stage: isCreator ? 'creator' : 'subscriber',
      externalUrlPath: '/account',
      tags: ['2yolks', isCreator ? 'creator' : 'subscriber'],
    });
    if (pushRes.ok && pushRes.zelutoId) {
      await c.env.DB.prepare('UPDATE users SET zeluto_contact_id = ? WHERE id = ?')
        .bind(pushRes.zelutoId, user.id)
        .run()
        .catch(() => {});
    }
  }
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86_400 });
  const dest = `${next ?? '/account'}${qs(lang)}`;
  if (json) return c.json({ ok: true, email: user.email, next: dest }, 200, NO_STORE);
  return c.redirect(dest, 303);
}

accountApp.post('/verify', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const queryNext = safeNextPath(c.req.query('next'));
  const json = wantsJson(c);
  const form = await readBody(c);
  const next = safeNextPath(form['next']) ?? queryNext;
  const gEnabled = googleOAuthEnabled(c.env);
  const fail = (status: 400 | 429 | 503, kind: 'signin' | 'code', msg: string, email = '', restart = false) => {
    if (json) return c.json({ ok: false, error: msg, ...(restart ? { restart: true } : {}) }, status, NO_STORE);
    const title = status === 429 ? t.titleSlowDown : kind === 'code' ? t.codePageTitle : t.signInPageTitle;
    const body = kind === 'code' ? codeForm(t, lang, email, banner('err', msg), next) : signInForm(t, lang, banner('err', msg), next, gEnabled);
    return page(c, title, body, status, next);
  };
  if (await limited(c.env.RL_AUTH, c, 'verify')) return fail(429, 'signin', t.errTooManyTries);
  const email = normEmail(form['email']);
  const code = str(form['code'], 12).trim();
  if (!email || !/^\d{6}$/.test(code)) return fail(400, 'code', t.errEnterCode, email ?? '');
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT id, code_hash AS hash FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > ? AND attempts < ? ORDER BY rowid DESC LIMIT 1')
    .bind(email, now, MAX_ATTEMPTS).first<{ id: string; hash: string }>();
  if (!row) return fail(400, 'signin', t.errCodeExpired, email, true);
  // Claim one attempt atomically; concurrent guesses cannot exceed the cap.
  const claim = await c.env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ? AND used = 0 AND attempts < ? AND expires_at > ?').bind(row.id, MAX_ATTEMPTS, now).run();
  if (claim.meta.changes !== 1) return fail(400, 'signin', t.errCodeExpired, email, true);
  const given = await sha256Hex(`${email}:${code}`);
  let diff = given.length ^ row.hash.length;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ (row.hash.charCodeAt(i) || 0);
  if (diff !== 0) return fail(400, 'code', t.errCodeWrong, email);
  // Single-use: exactly one concurrent correct submission can flip used 0 -> 1.
  const use = await c.env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ? AND used = 0').bind(row.id).run();
  if (use.meta.changes !== 1) return fail(400, 'signin', t.errCodeUsed, email, true);
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (id,email,display_name,created_at) VALUES (?,?,NULL,?)').bind(newId(), email, new Date().toISOString()).run();
    user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (!user) return fail(503, 'signin', t.errGeneric, email, true);
  }
  return issueUserSession(c, { id: user.id, email }, next, lang, json);
});

registerAuthMethodRoutes(accountApp, {
  safeNextPath,
  normEmail,
  str,
  newId,
  randomToken,
  sha256Hex,
  cleanupExpired,
  limited,
  readBody,
  wantsJson,
  page,
  renderSignIn: signInForm,
  issueUserSession,
});

accountApp.post('/logout', async (c) => {
  const tok = getCookie(c, SESSION_COOKIE);
  if (tok && /^[0-9a-f]{64}$/.test(tok)) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(tok)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
  return c.redirect(`/account${qs(langOf(c))}`, 303);
});

// Draft-first capture: GET /recipes/new and parse-only POST /recipes/paste work
// without an account; saving, AI calls, editing, and submitting require sign-in.
accountApp.use('/recipes/*', async (c, nextFn) => {
  const path = new URL(c.req.url).pathname;
  const openAnon =
    (c.req.method === 'GET' && (path === '/account/recipes/new' || path === '/recipes/new')) ||
    (c.req.method === 'POST' && (path === '/account/recipes/paste' || path === '/recipes/paste'));
  if (!openAnon && !c.get('user')) {
    if (path.endsWith('/recipes/ai-assist') || wantsJson(c)) {
      return c.json({ ok: false, session: true, error: accountStrings(langOf(c)).aiErrSession }, 401, NO_STORE);
    }
    const returnTo = c.req.method === 'GET' ? safeNextPath(path) : path.endsWith('/recipes/save') ? '/account/recipes/new' : null;
    return c.redirect(`/account${qsNext(langOf(c), returnTo)}`, 303);
  }
  await nextFn();
});

// --- Draft form --------------------------------------------------------------

export type FormState = {
  id?: string; title: string; intro: string; ingredients: string; steps: string; locale: string; category: string;
  prep: string; cook: string; servings: string; displayName: string; sourceKind: 'original' | 'adapted'; sourceUrl: string;
  attest: boolean; photoUrl?: string | null;
};
const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français' };
const blank = (user: { displayName: string | null } | null): FormState => ({
  title: '', intro: '', ingredients: '', steps: '', locale: 'us:en', category: '', prep: '', cook: '', servings: '',
  displayName: user?.displayName ?? '', sourceKind: 'original', sourceUrl: '', attest: false,
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

/** Form fields that can carry an inline error (name attribute; the control id is `f-<name>`). */
export type FormField = 'category' | 'title' | 'locale' | 'intro' | 'ingredients' | 'steps' | 'prep' | 'cook' | 'servings' | 'dish_photo' | 'display_name' | 'source_kind' | 'source_url' | 'attest';
export type FieldError = { field?: FormField; msg: string };

/** Map a contracts-validator failure (path + raw message) to the form control it belongs to. */
export function fieldForValidatorPath(path: string, message: string): FormField | undefined {
  const p = path.replace(/^locales\[\d+\]\.?/, '');
  if (p.startsWith('title') || p.startsWith('slug')) return 'title';
  if (p.startsWith('intro')) return 'intro';
  if (p.startsWith('ingredients')) return 'ingredients';
  if (p.startsWith('steps')) return 'steps';
  if (p.startsWith('category')) return 'category';
  if (p === 'times' || ['prepMinutes', 'cookMinutes', 'baseServings'].some((k) => p.startsWith(k))) {
    const key = p === 'times' ? message : p;
    if (key.startsWith('prepMinutes')) return 'prep';
    if (key.startsWith('cookMinutes')) return 'cook';
    if (key.startsWith('baseServings')) return 'servings';
    return undefined;
  }
  if (p.startsWith('source.url')) return 'source_url';
  if (p.startsWith('source.name')) return 'display_name';
  if (p.startsWith('source')) return 'source_kind';
  if (p.startsWith('originCountry') || p.startsWith('country') || p.startsWith('lang')) return 'locale';
  return undefined;
}

const removeDraftForm = (t: AccountStrings, lang: string, id: string) =>
  `<form method="post" action="/account/recipes/${esc(id)}/delete${qs(lang)}"><button class="quiet" type="submit">${t.removeDraft}</button></form>`;

function renderForm(s: FormState, t: AccountStrings, acctLang: string, errors: ReadonlyArray<string | FieldError> = [], note = '', importOn = false, extras = '', signedIn = true, gapPrompts: string[] = [], googleEnabled = false): string {
  // Errors show twice: a linked summary at the top (role=alert) and inline
  // next to the offending control (aria-invalid + aria-describedby).
  const errs: FieldError[] = errors.map((e) => (typeof e === 'string' ? { msg: e } : e));
  const byField = new Map<FormField, string[]>();
  for (const e of errs) if (e.field) byField.set(e.field, [...(byField.get(e.field) ?? []), e.msg]);
  const inv = (f: FormField) => (byField.has(f) ? ` aria-invalid="true" aria-describedby="err-${f}"` : '');
  const ferr = (f: FormField) => (byField.has(f) ? `<p class="field-err" id="err-${f}">${byField.get(f)!.map((m) => esc(m)).join(' ')}</p>` : '');
  const errBox = errs.length ? banner('err', `<strong>${t.fixThese}</strong><ul>${errs.map((e) => `<li>${e.field ? `<a href="#f-${e.field}">${esc(e.msg)}</a>` : esc(e.msg)}</li>`).join('')}</ul>`) : '';
  const aiPanel = signedIn
    ? `<div class="panel ai-panel" data-ai-panel data-ai-endpoint="/account/recipes/ai-assist${qs(acctLang)}" data-msg-working="${esc(t.aiWorking)}" data-msg-done-extract="${esc(t.aiDoneExtract)}" data-msg-done-polish="${esc(t.aiDonePolish)}" data-msg-done-translate="${esc(t.aiDoneTranslate)}" data-msg-err-input="${esc(t.aiErrInput)}" data-msg-err-generic="${esc(t.errGeneric)}" data-msg-err-session="${esc(t.aiErrSession)}" data-msg-signin="${esc(t.aiSignInLink)}" data-signin-url="/account${qs(acctLang)}" data-msg-translate-unavailable="${esc(t.aiErrTranslateUnavailable)}" data-msg-fallback="${esc(t.aiFallbackNote)}">
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
  <div data-ai-status role="status" aria-live="polite" hidden></div>
  <div class="ai-feedback" data-ai-improvements-wrap hidden><h3>${t.aiImprovementsHeading}</h3><ul data-ai-improvements></ul></div>
  <div class="ai-feedback" data-ai-questions-wrap hidden><h3>${t.aiQuestionsHeading}</h3><div data-ai-questions></div></div>
</div></div>`
    : `<div class="panel ai-panel"><h2>${t.aiPanelTitle}</h2><p class="hint">${t.aiSignInNote}</p><p><a class="btn" href="/account${qsNext(acctLang, '/account/recipes/new')}">${t.signInPageTitle}</a></p></div>`;
  const startTiles = s.id ? '' : `<div class="start-section" data-start-section>
<p class="start-heading">${t.startHeading}</p>
<div class="start-tiles" data-start-tiles role="group" aria-label="${esc(t.startHeading)}">
  <button type="button" class="start-tile" data-start-tile="photo" aria-pressed="false"><strong>${t.tilePhotoTitle}</strong><span>${t.tilePhotoHint}</span></button>
  <button type="button" class="start-tile" data-start-tile="paste" aria-pressed="false"><strong>${t.tilePasteTitle}</strong><span>${t.tilePasteHint}</span></button>
  <button type="button" class="start-tile" data-start-tile="type" aria-pressed="true"><strong>${t.tileTypeTitle}</strong><span>${t.tileTypeHint}</span></button>
</div></div>`;
  const photoMode = s.id ? aiPanel : `<div data-mode-panel="photo">${aiPanel}</div>`;
  const pasteMode = s.id ? '' : `<div class="panel" data-mode-panel="paste"><h2>${t.startFaster}</h2>
<form method="post" action="/account/recipes/paste${qs(acctLang)}" data-paste-form data-msg-working="${esc(t.pasteWorking)}" data-msg-err-generic="${esc(t.errGeneric)}"><label>${t.pasteLabel}<small>${t.pasteHint}</small><textarea name="text" maxlength="60000"></textarea></label><div class="paste-actions"><button class="quiet" type="submit" data-paste-submit>${t.pasteButton}</button><button type="button" class="quiet" data-paste-undo hidden>${t.pasteUndo}</button></div><div data-paste-status role="status" aria-live="polite" hidden></div></form>
${importOn && signedIn ? `<form method="post" action="/account/recipes/import${qs(acctLang)}"><label>${t.importLabel}<small>${t.importHint}</small><input type="url" name="url" maxlength="2000" placeholder="https://"></label><button class="quiet" type="submit">${t.importButton}</button></form>` : `<p class="hint"><strong>${t.importOffName}</strong> ${t.importOffText}</p>`}</div>`;
  const lang = acctLang;
  const ft = FORM_STRINGS[lang]!;
  // Finish: the permission box sits right next to "Send in for review".
  // "Save private draft" comes first in DOM order so Enter in a text field
  // saves a draft and never sends anything in by accident.
  const finish = `<div class="panel finish" data-finish>
<h2>${t.finishTitle}</h2><p class="hint">${t.finishHint}</p>
<label class="check"><input type="checkbox" name="attest" value="1" id="f-attest" data-err-attest="${esc(t.errAttestToSubmit)}"${s.attest ? ' checked' : ''}${inv('attest')}><span>${t.attestText}</span></label>${ferr('attest')}
<div class="finish-actions"><button class="quiet" type="submit" name="intent" value="save">${t.saveDraft}</button><button type="submit" name="intent" value="submit" data-submit-review>${t.submitButton}</button></div>
</div>`;
  const inlineAuth = signedIn ? '' : `<div class="panel inline-auth" data-inline-auth hidden
  data-code-endpoint="/account/code${qs(acctLang)}"
  data-verify-endpoint="/account/verify${qs(acctLang)}"
  data-msg-sent="${esc(t.authCodeSent)}"
  data-msg-working="${esc(t.authWorking)}"
  data-msg-done="${esc(t.authDone)}"
  data-msg-err-email="${esc(t.errInvalidEmail)}"
  data-msg-err-code="${esc(t.errEnterCode)}"
  data-msg-err-passkey-cancel="${esc(t.errPasskeyCancelled)}"
  data-msg-err-generic="${esc(t.errGeneric)}">
  <h2>${t.authStepTitle}</h2>
  <p class="hint">${t.authStepLead}</p>
  <div data-inline-auth-email-step>
    <div class="alt-auth-actions">
      <button type="button" class="quiet btn-passkey" data-inline-passkey-login hidden data-options-url="/account/passkey/login/options${qs(acctLang)}" data-verify-url="/account/passkey/login/verify${qs(acctLang)}">${t.passkeySignInBtn}</button>
      ${googleEnabled ? `<a class="btn-google" data-inline-google-login href="/account/google/start${qsNext(acctLang, '/account/recipes/new')}">${t.googleSignInBtn}</a>` : ''}
    </div>
    <label>${t.signInEmailLabel}<input type="email" data-auth-email autocomplete="email" maxlength="254"></label>
    <div class="inline-auth-actions"><button type="button" data-auth-send>${t.signInButton}</button></div>
  </div>
  <div data-inline-auth-code-step hidden>
    <p class="hint" data-auth-code-lead></p>
    <label>${t.codeLabel}<input type="text" data-auth-code inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6"></label>
    <div class="inline-auth-actions">
      <button type="button" data-auth-verify>${t.authVerifyBtn}</button>
      <button type="button" class="quiet" data-auth-change>${t.authChangeEmail}</button>
    </div>
  </div>
  <div data-inline-auth-status role="status" aria-live="polite" hidden></div>
</div>`;
  const stepNav = (idx: number) => `<div class="step-nav" data-step-nav="${idx}">
<div class="step-msg" data-step-msg role="status" aria-live="polite" hidden></div>
${idx > 0 ? `<button type="button" class="quiet" data-step-prev>${t.stepBack}</button>` : ''}
${idx < 4 ? `<button type="button" data-step-next>${t.stepNext}</button>` : ''}
</div>`;
  const stepIndex = `<nav class="step-index" aria-label="${esc(t.stepIndexLabel)}" data-step-index>
<a href="#step-basics" data-step-jump="0">${t.stepBasics}</a>
<a href="#step-ingredients" data-step-jump="1">${t.stepIngredients}</a>
<a href="#step-steps" data-step-jump="2">${t.stepSteps}</a>
<a href="#step-details" data-step-jump="3">${t.stepDetails}</a>
<a href="#step-credit" data-step-jump="4">${t.stepCredit}</a>
</nav>`;
  const stepperBar = `<div class="stepper-bar" data-stepper-bar hidden>
<span class="stepper-progress-text" data-step-progress></span>
<div class="stepper-track" aria-hidden="true"><div class="stepper-fill" data-step-fill></div></div>
<button type="button" class="quiet stepper-preview-btn" data-preview-toggle aria-pressed="false">${t.previewTab}</button>
</div>`;
  const preview = `<aside class="capture-preview-col" data-live-preview aria-label="${esc(t.previewTitle)}">
<div class="capture-preview-head"><h2>${t.previewTitle}</h2><button type="button" class="quiet preview-back-btn" data-preview-back hidden>${t.previewBackToForm}</button></div>
<div class="preview-card">
  <span class="preview-badge">${t.previewBadge}</span>
  <img class="preview-photo" data-preview-photo alt="" hidden>
  <p class="preview-eyebrow" data-preview-category hidden></p>
  <h3 class="preview-title" data-preview-title data-empty-title="${esc(t.previewUntitled)}">${esc(s.title || t.previewUntitled)}</h3>
  <div class="preview-facts" data-preview-facts data-tpl-prep="${esc(t.previewPrep)}" data-tpl-cook="${esc(t.previewCook)}" data-tpl-serves="${esc(t.previewServes)}"></div>
  <p class="preview-intro" data-preview-intro hidden></p>
  <p class="hint preview-empty" data-preview-empty>${t.previewEmpty}</p>
  <div data-preview-ing-wrap hidden><h4>${t.labelIngredients}</h4><ul class="preview-ing" data-preview-ings></ul></div>
  <div data-preview-step-wrap hidden><h4>${t.labelSteps}</h4><ol class="preview-steps" data-preview-steps></ol></div>
</div></aside>`;
  const lead = s.id ? t.formLead : signedIn ? t.formLead : t.formPromise;
  const gapBanner = gapPrompts.length && !s.id
    ? `<div class="panel gap-prompts" data-gap-prompts><h2>${fill(t.gapPromptLead, { query: esc(gapPrompts[0]!) })}</h2><div class="gap-chip-row">${gapPrompts.map((gp, i) => `<button type="button" class="gap-chip${i === 0 ? '' : ' quiet'}" data-gap-chip="${esc(titleCasePrompt(gp))}">${esc(gp)}</button>`).join('')}</div></div>`
    : '';
  const unitOptions = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pinch', 'clove', 'can', 'slice', 'piece', 'bunch', 'sprig']
    .map((u) => `<option value="${u}">`)
    .join('');
  return `<h1>${s.id ? t.formTitleEdit : t.formTitleNew}</h1><p class="lead">${lead}</p>${note}${errBox}
<div class="capture-shell" data-capture-shell>
<div class="capture-main">
${gapBanner}${startTiles}${photoMode}${pasteMode}${stepIndex}${stepperBar}
<form method="post" action="/account/recipes/save${qs(acctLang)}" enctype="multipart/form-data" data-capture-form data-signed-in="${signedIn ? '1' : '0'}" data-step-progress-tpl="${esc(t.stepProgress)}" data-step-need-required="${esc(t.stepNeedRequired)}" data-step-soft-warn="${esc(t.stepSoftWarn)}">${s.id ? `<input type="hidden" name="id" value="${esc(s.id)}">` : ''}
<fieldset class="form-step" id="step-basics" data-step="0"><legend class="step-heading" tabindex="-1">${t.stepBasics}</legend>
<label><span data-category-prompt>${esc(ft.prompt)}</span><select name="category" id="f-category"${inv('category')}>${categoryOptions(s.category, lang)}</select></label>${ferr('category')}
<label>${t.labelTitle}<input type="text" name="title" id="f-title" value="${esc(s.title)}" maxlength="200" required${inv('title')}></label>${ferr('title')}
<label>${t.labelLanguage}<select name="locale" id="f-locale"${inv('locale')}>${localeOptions(s.locale)}</select></label>${ferr('locale')}
<label><span data-preamble-label>${esc(ft.preamble)}</span> <small data-preamble-hint>${esc(ft.preambleHint)}</small><textarea name="intro" id="f-intro" maxlength="2000" style="min-height:4rem"${inv('intro')}>${esc(s.intro)}</textarea></label>${ferr('intro')}
${stepNav(0)}</fieldset>
<fieldset class="form-step" id="step-ingredients" data-step="1"><legend class="step-heading" tabindex="-1">${t.stepIngredients}</legend>
<div class="field-head-row"><label for="f-ingredients">${t.labelIngredients}</label><span class="line-counter" data-ing-counter data-tpl="${esc(t.lineLimitBadge)}">${esc(fill(t.lineLimitBadge, { n: rawLineCount(s.ingredients), max: MAX_RECIPE_LINES }))}</span></div>
<small class="hint">${t.ingredientsHint}</small>
<div class="ing-builder" data-ing-builder data-ph-qty="${esc(t.ingQtyPlaceholder)}" data-ph-unit="${esc(t.ingUnitPlaceholder)}" data-ph-item="${esc(t.ingItemPlaceholder)}" data-ph-section="${esc(t.ingSectionPlaceholder)}" data-lbl-up="${esc(t.moveUp)}" data-lbl-down="${esc(t.moveDown)}" data-lbl-del="${esc(t.removeRow)}">
  <div class="builder-toolbar"><div class="builder-mode-tabs"><button type="button" data-ing-mode-rows aria-pressed="true">${esc(t.ingModeRows)}</button><button type="button" data-ing-mode-raw aria-pressed="false">${esc(t.ingModeRaw)}</button></div></div>
  <div class="builder-rows-wrap"><div data-ing-rows></div><div class="builder-add-actions"><button type="button" class="quiet" data-ing-add>${esc(t.ingAddRow)}</button><button type="button" class="quiet" data-ing-add-section>${esc(t.ingAddSection)}</button></div></div>
  <datalist id="capture-units">${unitOptions}</datalist>
  <textarea name="ingredients" id="f-ingredients" required${inv('ingredients')}>${esc(s.ingredients)}</textarea>
</div>${ferr('ingredients')}
${stepNav(1)}</fieldset>
<fieldset class="form-step" id="step-steps" data-step="2"><legend class="step-heading" tabindex="-1">${t.stepSteps}</legend>
<div class="field-head-row"><label for="f-steps">${t.labelSteps}</label><span class="line-counter" data-step-counter data-tpl="${esc(t.lineLimitBadge)}">${esc(fill(t.lineLimitBadge, { n: rawLineCount(s.steps), max: MAX_RECIPE_LINES }))}</span></div>
<small class="hint">${t.stepsHint}</small>
<div class="step-builder" data-step-builder data-ph-step="${esc(t.stepPlaceholder)}" data-lbl-timer="${esc(t.stepTimerLabel)}" data-lbl-up="${esc(t.moveUp)}" data-lbl-down="${esc(t.moveDown)}" data-lbl-del="${esc(t.removeRow)}">
  <div class="builder-toolbar"><div class="builder-mode-tabs"><button type="button" data-step-mode-cards aria-pressed="true">${esc(t.stepModeCards)}</button><button type="button" data-step-mode-raw aria-pressed="false">${esc(t.ingModeRaw)}</button></div></div>
  <div class="builder-rows-wrap"><div data-step-cards></div><div class="builder-add-actions"><button type="button" class="quiet" data-step-add>${esc(t.stepAddCard)}</button><button type="button" class="quiet" data-step-photo-jump>${esc(t.stepPhotoJump)}</button></div></div>
  <textarea name="steps" id="f-steps" required${inv('steps')}>${esc(s.steps)}</textarea>
</div>${ferr('steps')}
${stepNav(2)}</fieldset>
<fieldset class="form-step" id="step-details" data-step="3"><legend class="step-heading" tabindex="-1">${t.stepDetails}</legend>
<div class="row"><label>${t.labelPrep} <small>${t.optional}</small><input type="number" name="prep" id="f-prep" min="0" max="20000" value="${esc(s.prep)}"${inv('prep')}></label><label>${t.labelCook} <small>${t.optional}</small><input type="number" name="cook" id="f-cook" min="0" max="20000" value="${esc(s.cook)}"${inv('cook')}></label></div>${ferr('prep')}${ferr('cook')}
<label>${t.labelServings} <small>${t.optional}</small><input type="number" name="servings" id="f-servings" min="1" max="1000" step="any" value="${esc(s.servings)}"${inv('servings')}></label>${ferr('servings')}
${renderDraftPhotoField(t, s, ferr('dish_photo'), inv('dish_photo'))}
${stepNav(3)}</fieldset>
<fieldset class="form-step" id="step-credit" data-step="4"><legend class="step-heading" tabindex="-1">${t.stepCredit}</legend>
<label>${t.labelAuthor}<input type="text" name="display_name" id="f-display_name" value="${esc(s.displayName)}" maxlength="80" required${inv('display_name')}></label>${ferr('display_name')}
<label>${t.labelSource}<select name="source_kind" id="f-source_kind"${inv('source_kind')}><option value="original"${s.sourceKind === 'original' ? ' selected' : ''}>${t.sourceOriginal}</option><option value="adapted"${s.sourceKind === 'adapted' ? ' selected' : ''}>${t.sourceAdapted}</option></select></label>${ferr('source_kind')}
<div class="field" data-source-link><label>${t.labelSourceLink} <small>${t.sourceLinkHint}</small><input type="url" name="source_url" id="f-source_url" value="${esc(s.sourceUrl)}" maxlength="2000" placeholder="https://"${inv('source_url')}></label>${ferr('source_url')}</div>
<ul class="live-checks" data-live-checks><li data-check="title"></li><li data-check="ingredients"></li><li data-check="qty"></li><li data-check="cups"></li><li data-check="steps"></li><li data-check="servings"></li><li data-check="source"></li></ul>
${finish}${inlineAuth}${stepNav(4)}</fieldset></form>${extras}</div>${preview}</div>${captureDataIslands()}<script>${CAPTURE_CLIENT_SCRIPT}</script><script>${DRAFT_PHOTO_CLIENT_SCRIPT}</script>`;
}

export function parseForm(form: Record<string, unknown>, user: { displayName: string | null } | null): FormState {
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

export async function loadOwned(c: { env: { DB: D1Database }; get(key: 'user'): AccountUser | null }, id: string) {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const rows = await db.select({ r: recipes, l: recipeLocales, s: sources })
    .from(recipes).innerJoin(recipeLocales, eq(recipeLocales.recipeId, recipes.id)).innerJoin(sources, eq(sources.id, recipes.sourceId))
    .where(and(
      eq(recipes.id, id),
      eq(recipes.ownerUserId, user.id),
      isNull(recipes.removedByUserAt),
      or(ne(recipeLocales.status, 'rejected'), eq(recipes.reviewStatus, 'declined')),
    ));
  return rows.find((x) => x.l.status === 'published') ?? rows[0] ?? null;
}

/**
 * Send one budgeted, localized author status email (never unbudgeted, never blocks review writes).
 * Uses the shared rolling 24h 'notice' quota (NOTICES_PER_DAY = 8).
 */
export async function sendAuthorReviewNotice(
  env: MailEnv & { CANONICAL_ORIGIN?: string },
  db: D1Database,
  opts: {
    email: string;
    lang: string | null | undefined;
    kind: 'needs_changes' | 'declined' | 'published';
    title: string;
    recipeId: string;
    note?: string | null;
    livePath?: string | null;
  },
): Promise<'sent' | 'skipped_budget' | 'skipped_no_mail' | 'failed'> {
  if (!env.RESEND_API_KEY) return 'skipped_no_mail';
  if (!(await reserveMail(db, 'notice', NOTICES_PER_DAY))) return 'skipped_budget';
  const noticeLang = isAccountLang(opts.lang) ? opts.lang : 'en';
  const t = accountStrings(noticeLang);
  const origin = (env.CANONICAL_ORIGIN || 'https://2yolks.com').replace(/\/+$/, '');
  const editUrl = `${origin}/account/recipes/${opts.recipeId}/edit${qs(noticeLang)}`;
  const accountUrl = `${origin}/account${qs(noticeLang)}`;
  const liveUrl = opts.livePath ? `${origin}${opts.livePath}` : accountUrl;
  const note = opts.note ?? '';
  let subject = '';
  let text = '';
  if (opts.kind === 'needs_changes') {
    subject = fill(t.mailNeedsChangesSubject, { title: opts.title });
    text = fill(t.mailNeedsChangesBody, { title: opts.title, note, editUrl });
  } else if (opts.kind === 'declined') {
    subject = fill(t.mailDeclinedSubject, { title: opts.title });
    text = fill(t.mailDeclinedBody, { title: opts.title, note, accountUrl });
  } else {
    subject = fill(t.mailPublishedSubject, { title: opts.title });
    text = fill(t.mailPublishedBody, { title: opts.title, liveUrl });
  }
  try {
    const ok = await sendMail(env, { to: opts.email, subject: subject.slice(0, 180), text });
    return ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

const rf = (c: Ctx, s: FormState, errors: ReadonlyArray<string | FieldError> = [], note = '', extras = '', gapPrompts: string[] = []) => {
  const lang = langOf(c);
  return renderForm(s, accountStrings(lang), lang, errors, note, c.env.IMPORT_ENABLED === 'true', extras, Boolean(c.get('user')), gapPrompts, googleOAuthEnabled(c.env));
};

accountApp.get('/recipes/new', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const s = blank(c.get('user'));
  let note = '';
  let remixLoaded = false;

  const rawRemix = (c.req.query('remix') ?? '').trim();
  if (/^[A-Za-z0-9_-]{1,40}$/.test(rawRemix)) {
    const demoFilter = c.env.ALLOW_DEMO_SEED === 'true' ? '' : "AND s.license != 'internal-demo'";
    const rows = await c.env.DB.prepare(
      `SELECT l.country, l.lang, l.title, l.slug, l.ingredients_json, l.steps_json,
              r.prep_minutes, r.cook_minutes, r.base_servings, r.category, r.author_name,
              s.name AS source_name
       FROM recipe_locales l
       JOIN recipes r ON r.id = l.recipe_id
       JOIN sources s ON s.id = r.source_id
       WHERE r.id = ? AND l.status = 'published' AND s.cleared_at IS NOT NULL ${demoFilter}`,
    ).bind(rawRemix).all<{
      country: string; lang: string; title: string; slug: string;
      ingredients_json: string; steps_json: string;
      prep_minutes: number | null; cook_minutes: number | null; base_servings: number | null;
      category: string | null; author_name: string | null; source_name: string;
    }>();
    const list = rows.results ?? [];
    const picked = list.find((r) => r.lang === lang) ?? list.find((r) => r.lang === 'en') ?? list[0];
    if (picked) {
      remixLoaded = true;
      let entries: IngredientEntry[] = [];
      let stepArr: string[] = [];
      try {
        const parsedIng = JSON.parse(picked.ingredients_json) as unknown[];
        if (Array.isArray(parsedIng)) entries = parsedIng as IngredientEntry[];
      } catch { entries = []; }
      try {
        const parsedSt = JSON.parse(picked.steps_json) as unknown[];
        if (Array.isArray(parsedSt)) stepArr = parsedSt.map((x) => String(x));
      } catch { stepArr = []; }
      const sys = defaultUnitSystem(picked.country);
      const httpsOrigin = (c.env.CANONICAL_ORIGIN && c.env.CANONICAL_ORIGIN.startsWith('https://') ? c.env.CANONICAL_ORIGIN : 'https://2yolks.com').replace(/\/+$/, '');
      s.title = fill(t.remixTitleTpl, { title: picked.title }).slice(0, 200);
      s.intro = fill(t.remixIntroTpl, { title: picked.title, author: picked.author_name?.trim() || picked.source_name }).slice(0, 2000);
      s.locale = `${picked.country}:${picked.lang}`;
      s.category = isRecipeCategorySlug(picked.category) ? picked.category : '';
      s.ingredients = entries.map((e) => renderIngredient(e, picked.lang, sys, 1)).filter(Boolean).join('\n');
      s.steps = stepArr.map((st) => renderStep(st, entries, picked.lang, sys, 1)).filter(Boolean).join('\n');
      s.prep = picked.prep_minutes != null ? String(picked.prep_minutes) : '';
      s.cook = picked.cook_minutes != null ? String(picked.cook_minutes) : '';
      s.servings = picked.base_servings != null ? String(picked.base_servings) : '';
      s.sourceKind = 'adapted';
      s.sourceUrl = `${httpsOrigin}${recipePathFor(picked.country, picked.lang, picked.slug)}`;
      note = `<div class="ok remix-banner" data-remix-banner>${fill(t.remixBanner, { title: esc(picked.title) })}</div>`;
    }
  } else {
    const cleanPrompt = sanitizeSearchGapPrompt(c.req.query('prompt'));
    if (cleanPrompt) {
      s.title = titleCasePrompt(cleanPrompt);
      note = `<div class="ok gap-prefilled" data-gap-prefilled>${fill(t.gapPrefilledBanner, { query: esc(cleanPrompt) })}</div>`;
    }
  }

  const gapPrompts = remixLoaded
    ? []
    : (await loadTopSearchGaps(c.env.DB, lang, 4)).filter((g) => g.toLowerCase() !== s.title.toLowerCase());
  return page(c, t.formTitleNew, rf(c, s, [], note, '', gapPrompts), 200, null, true);
});

accountApp.post('/recipes/paste', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const json = wantsJson(c);
  if (await limited(c.env.RL_SUBMIT, c, 'paste')) {
    if (json) return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    return page(c, t.titleSlowDown, rf(c, blank(c.get('user')), [t.errTooManyTries]), 429, null, true);
  }
  const form = await readBody(c);
  const p = parseRecipeText(str(form['text'], 60000));
  if (json) {
    return c.json({
      ok: true,
      parsed: {
        title: p.title,
        intro: p.intro,
        ingredients: p.ingredients.join('\n'),
        steps: p.steps.join('\n'),
        prep: p.prepMinutes ? String(p.prepMinutes) : '',
        cook: p.cookMinutes ? String(p.cookMinutes) : '',
        servings: p.servings ? String(p.servings) : '',
      },
      warnings: p.warnings.map((w) => parseWarningMessage(t, w)),
      message: t.pasteFilled,
    }, 200, NO_STORE);
  }
  const warn = p.warnings.length ? banner('err', p.warnings.map((w) => esc(parseWarningMessage(t, w))).join('<br>')) : banner('ok', t.pasteFilled);
  return page(c, t.formTitleNew, rf(c, fromParsed(blank(c.get('user')), p), [], warn), 200, null, true);
});

accountApp.post('/recipes/ai-assist', async (c) => {
  const user = c.get('user')!;
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

  const req: AiAssistRequest = { mode, uiLang, recipeLocale, targetLocale, notes, image, audio, draft };
  // Honest fallback: without GEMINI_API_KEY we cannot translate or read a
  // photo/voice note. Say so before spending budget, never fake a success.
  const unavailable = aiUnavailableReason(req, c.env.GEMINI_API_KEY);
  if (unavailable) {
    return c.json({ ok: false, unavailable, error: unavailable === 'translate' ? t.aiErrTranslateUnavailable : t.aiErrMediaUnavailable }, 503, { 'cache-control': 'no-store' });
  }

  const dailyCap = c.env.AI_DAILY_CAP && Number(c.env.AI_DAILY_CAP) > 0 ? Number(c.env.AI_DAILY_CAP) : DEFAULT_AI_DAILY_CAP;
  if (!(await reserveAiBudget(c.env.DB, user.id, mode, dailyCap))) {
    return c.json({ ok: false, error: t.aiErrBusy }, 429, { 'cache-control': 'no-store' });
  }

  try {
    const out = await assistRecipe(req, { apiKey: c.env.GEMINI_API_KEY });
    return c.json({ ok: true, ...out }, 200, { 'cache-control': 'no-store' });
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      if (e.reason === 'empty') return c.json({ ok: false, error: t.aiErrInput }, 400, { 'cache-control': 'no-store' });
      return c.json({ ok: false, unavailable: e.reason, error: e.reason === 'translate' ? t.aiErrTranslateUnavailable : t.aiErrMediaUnavailable }, 503, { 'cache-control': 'no-store' });
    }
    return c.json({ ok: false, error: t.errGeneric }, 503, { 'cache-control': 'no-store' });
  }
});

accountApp.post('/recipes/import', async (c) => {
  const user = c.get('user')!;
  const t = accountStrings(langOf(c));
  if (c.env.IMPORT_ENABLED !== 'true') return page(c, t.formTitleNew, rf(c, blank(user), [t.errImportOff]), 404, null, true);
  if (await limited(c.env.RL_SUBMIT, c, 'import')) return page(c, t.titleSlowDown, rf(c, blank(user), [t.errTooManyImports]), 429, null, true);
  const form = await c.req.parseBody();
  const url = str(form['url'], 2000).trim();
  try {
    const { url: finalUrl, text } = await safeFetchText(url);
    const p = parseJsonLdRecipe(text);
    if (!p) return page(c, t.formTitleNew, rf(c, blank(user), [t.errNoRecipeData]), 400, null, true);
    const s = { ...fromParsed(blank(user), p), sourceKind: 'adapted' as const, sourceUrl: finalUrl };
    return page(c, t.formTitleNew, rf(c, s, [], banner('ok', fill(t.importFilled, { host: esc(new URL(finalUrl).hostname) }))), 200, null, true);
  } catch (e) {
    const msg = e instanceof SsrfError ? ssrfMessage(t, e.message) : t.errReadLink;
    return page(c, t.formTitleNew, rf(c, blank(user), [msg]), 400, null, true);
  }
});

accountApp.get('/recipes/:id/edit', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  if (row.r.reviewStatus === 'declined' || row.l.status === 'rejected') {
    const noteHtml = row.r.reviewNote ? `<p class="review-note review-note--declined">${esc(row.r.reviewNote)}</p>` : '';
    return page(c, t.statusDeclined, `${banner('err', t.declinedBanner)}${noteHtml}<p>${t.declinedEditNote}</p>${copyDeclinedForm(t, lang, row.r.id)}`, 409);
  }
  if (row.r.submittedAt || row.l.status === 'published' || row.r.reviewStatus === 'published') {
    const liveBtn = row.l.status === 'published' ? `<p><a class="btn" href="${esc(recipePathFor(row.l.country, row.l.lang, row.l.slug))}">${t.viewLiveRecipe}</a></p>` : '';
    return page(c, t.titleSubmitted, `${banner('ok', t.okAlreadySentEdit)}${liveBtn}`, 409);
  }
  const user = c.get('user')!;
  const pendingPhoto = await activeDraftPhoto(c.env.DB, row.r.id, user.id);
  const sysEdit = defaultUnitSystem(row.l.country);
  const ing = (JSON.parse(row.l.ingredientsJson) as unknown[]).map((x) => (typeof x === 'string' ? x : renderIngredient(x as IngredientEntry, row.l.lang, sysEdit, 1))).join('\n');
  const s: FormState = {
    id: row.r.id, title: row.l.title, intro: row.l.intro ?? '', ingredients: ing, steps: (JSON.parse(row.l.stepsJson) as string[]).join('\n'),
    locale: `${row.l.country}:${row.l.lang}`, prep: row.r.prepMinutes?.toString() ?? '', cook: row.r.cookMinutes?.toString() ?? '', servings: row.r.baseServings?.toString() ?? '',
    category: row.r.category ?? '',
    displayName: row.r.authorName ?? user.displayName ?? '', sourceKind: row.s.license === 'user-adapted' ? 'adapted' : 'original', sourceUrl: row.s.license === 'user-adapted' ? row.s.url : '',
    attest: !!row.r.attestedAt,
    photoUrl: pendingPhoto ? `/account/recipes/${esc(row.r.id)}/photo` : null,
  };
  const notes: string[] = [];
  if (c.req.query('saved')) notes.push(banner('ok', t.okSaved));
  if (c.req.query('copied')) notes.push(banner('ok', t.copyCreated));
  if (row.r.reviewStatus === 'needs_changes') {
    const lead = row.r.reviewNote ? `<p>${fill(t.needsChangesLead, { note: esc(row.r.reviewNote) })}</p>` : '';
    notes.push(`<div class="review-callout" role="note"><strong>${t.needsChangesBanner}</strong>${lead}</div>`);
  }
  return page(c, t.formTitleEdit, rf(c, s, [], notes.join(''), removeDraftForm(t, lang, row.r.id)), 200, null, true);
});

accountApp.post('/recipes/save', async (c) => {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  // Parse first (bodyLimit protects size) so every error page re-renders what the cook typed.
  const form = await c.req.parseBody() as Record<string, unknown>;
  const s = parseForm(form, user);
  const wantsSubmit = str(form['intent'], 10) === 'submit';
  const formTitle = s.id ? t.formTitleEdit : t.formTitleNew;
  const extras = s.id ? removeDraftForm(t, lang, s.id) : '';
  if (await limited(c.env.RL_SUBMIT, c, 'save') || (wantsSubmit && await limited(c.env.RL_SUBMIT, c, 'submit'))) {
    return page(c, t.titleSlowDown, rf(c, s, [t.errTooManyTries], '', extras), 429, null, true);
  }
  const errors: FieldError[] = [];
  const push = (e: FieldError) => { if (!errors.some((x) => x.field === e.field && x.msg === e.msg)) errors.push(e); };
  if (!s.displayName) push({ field: 'display_name', msg: t.errAuthorRequired });
  if (s.sourceKind === 'adapted' && !/^https:\/\//.test(s.sourceUrl)) push({ field: 'source_url', msg: t.errAdaptedHttps });
  const [country, recipeLang] = s.locale.split(':');
  const localeOk = !!country && !!recipeLang && (LOCALES[country] ?? []).includes(recipeLang) && !!getCountry(country);
  if (!localeOk) push({ field: 'locale', msg: t.errPickLanguage });
  // Sending in always needs the rights attestation (also re-checked in SQL by sendForReview).
  if (wantsSubmit && !s.attest) push({ field: 'attest', msg: t.errAttestToSubmit });
  if (rawLineCount(s.ingredients) > MAX_RECIPE_LINES) push({ field: 'ingredients', msg: fill(t.errTooManyIngredients, { max: MAX_RECIPE_LINES }) });
  if (rawLineCount(s.steps) > MAX_RECIPE_LINES) push({ field: 'steps', msg: fill(t.errTooManySteps, { max: MAX_RECIPE_LINES }) });
  const origin = c.env.CANONICAL_ORIGIN ?? new URL(c.req.url).origin;
  // Run the validator whenever the locale is usable so every problem shows at once.
  const result = localeOk ? validateRecipeSubmission(buildSubmission(s, origin)) : null;
  if (result && !result.ok) {
    for (const f of result.errors) {
      const field = fieldForValidatorPath(f.path, f.message);
      if (field && errors.some((e) => e.field === field)) continue; // one message per control is enough
      push({ field, msg: validatorMessage(t, f.path, f.message) });
    }
  }
  const uploadedPhoto = extractUploadedPhoto(form['dish_photo']);
  let preparedPhoto: ValidatedDraftPhoto | null = null;
  let photoErrStatus: 400 | 503 | null = null;
  if (uploadedPhoto) {
    const prepRes = await prepareDraftPhoto(c.env, { userId: user.id, recipeId: s.id, file: uploadedPhoto });
    if (!prepRes.ok) {
      push({ field: 'dish_photo', msg: photoErrorMessage(t, prepRes.reason) });
      photoErrStatus = prepRes.status;
    } else {
      preparedPhoto = prepRes.photo;
    }
  }
  if (errors.length || !result || !result.ok) {
    if (s.id) {
      const existing = await activeDraftPhoto(c.env.DB, s.id, user.id);
      if (existing) s.photoUrl = `/account/recipes/${esc(s.id)}/photo`;
    }
    return page(c, formTitle, rf(c, s, errors, '', extras), photoErrStatus && errors.length === 1 ? photoErrStatus : 400, null, true);
  }

  const sub = result.value;
  const loc = sub.locales[0]!;
  const D = c.env.DB;
  let id = s.id;
  if (id) {
    const owned = await loadOwned(c, id);
    if (!owned) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
    if (owned.r.reviewStatus === 'declined' || owned.l.status === 'rejected') {
      return page(c, t.statusDeclined, `${banner('err', t.declinedBanner)}${copyDeclinedForm(t, lang, id)}`, 409);
    }
    if (owned.r.submittedAt || owned.l.status === 'published' || owned.r.reviewStatus === 'published') return page(c, t.titleSubmitted, banner('err', t.errAlreadySent), 409);
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
    // One transaction (D1 batch). Every statement re-checks "owned, not submitted, not published/declined/removed"
    // so a concurrent submit or decision cannot be overwritten; nothing is deleted, rows are updated in place.
    const open = "EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL AND r.removed_by_user_at IS NULL AND (r.review_status IS NULL OR r.review_status = 'needs_changes')) AND NOT EXISTS (SELECT 1 FROM recipe_locales q WHERE q.recipe_id = ? AND q.status IN ('published', 'rejected'))";
    const guard = [id, user.id, id];
    const res = await D.batch([
      D.prepare(`UPDATE sources SET name = ?, url = ?, license = ? WHERE id = (SELECT source_id FROM recipes WHERE id = ?) AND ${open}`).bind(sub.source.name, sub.source.url, sub.source.license, id, ...guard),
      D.prepare(`UPDATE recipe_locales SET country = ?, lang = ?, title = ?, slug = ?, intro = ?, ingredients_json = ?, steps_json = ? WHERE recipe_id = ? AND ${open}`).bind(loc.country, loc.lang, loc.title, slug, loc.intro ?? null, ing, stp, id, ...guard),
      D.prepare(`UPDATE recipes SET origin_country = ?, prep_minutes = ?, cook_minutes = ?, base_servings = ?, attested_at = ?, author_name = ?, category = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND removed_by_user_at IS NULL AND (review_status IS NULL OR review_status = 'needs_changes')`).bind(sub.originCountry ?? null, prep, cook, serv, s.attest ? now : null, s.displayName, s.category || null, id, user.id),
      D.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(s.displayName, user.id),
    ]);
    if (res[1]!.meta.changes !== 1) return page(c, t.titleSubmitted, banner('err', t.errAlreadySentNoSave), 409);
  } else {
    const sourceId = `src-${id}`;
    // The draft-count cap is checked inside the inserts themselves (same transaction), so
    // concurrent creates cannot overshoot it. Nothing is written when the cap is hit.
    const room = "(SELECT count(*) FROM recipes r JOIN recipe_locales l ON l.recipe_id = r.id WHERE r.owner_user_id = ? AND r.removed_by_user_at IS NULL AND l.status <> 'rejected') < ? AND (SELECT count(*) FROM recipes WHERE owner_user_id = ?) < ?";
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
      return page(c, t.formTitleNew, rf(c, s, [msg]), 400, null, true);
    }
  }
  if (preparedPhoto) {
    await commitDraftPhoto(c.env, { userId: user.id, recipeId: id, photo: preparedPhoto, idGen: newId });
  } else if (s.id && wantsRemovePhoto(form)) {
    await deleteDraftPhoto(c.env, { recipeId: id, userId: user.id });
  }
  if (wantsSubmit) {
    // One clear finish: the draft (with its attestation) is saved above, then sent in here.
    const row = await loadOwned(c, id);
    if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
    return sendForReview(c, row);
  }
  return c.redirect(`/account/recipes/${id}/edit?saved=1${qsAmp(lang)}`, 303);
});

// Owner-only draft cover photo endpoints (never public; private, no-store).
accountApp.get('/recipes/:id/photo', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const notFound = () => c.text('not found', 404, NO_STORE);
  const owned = await loadOwned(c, id);
  if (!owned || !c.env.IMAGES) return notFound();
  const photo = await activeDraftPhoto(c.env.DB, id, user.id);
  if (!photo) return notFound();
  const obj = await c.env.IMAGES.get(photo.r2Key);
  if (!obj) return notFound();
  return new Response(obj.body, {
    headers: {
      'content-type': photo.mime,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});

accountApp.post('/recipes/:id/photo', async (c) => {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  const json = wantsJson(c);
  if (await limited(c.env.RL_SUBMIT, c, 'photo')) {
    if (json) return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    return page(c, t.titleSlowDown, banner('err', t.errTooManyTries), 429);
  }
  const id = c.req.param('id');
  const owned = await loadOwned(c, id);
  if (!owned) {
    if (json) return c.json({ ok: false, error: t.errDraftNotFound }, 404, NO_STORE);
    return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  }
  if (owned.r.submittedAt || owned.l.status === 'published' || owned.r.reviewStatus === 'published' || owned.r.reviewStatus === 'declined' || owned.l.status === 'rejected') {
    if (json) return c.json({ ok: false, error: t.errAlreadySent }, 409, NO_STORE);
    return page(c, t.titleSubmitted, banner('err', t.errAlreadySent), 409);
  }
  const form = await c.req.parseBody() as Record<string, unknown>;
  const file = extractUploadedPhoto(form['dish_photo'] ?? form['photo']);
  if (!file) {
    if (json) return c.json({ ok: false, error: t.errDraftPhotoRead }, 400, NO_STORE);
    return page(c, t.formTitleEdit, banner('err', t.errDraftPhotoRead), 400);
  }
  const prepRes = await prepareDraftPhoto(c.env, { userId: user.id, recipeId: id, file });
  if (!prepRes.ok) {
    const msg = photoErrorMessage(t, prepRes.reason);
    if (json) return c.json({ ok: false, error: msg }, prepRes.status, NO_STORE);
    return page(c, t.formTitleEdit, banner('err', msg), prepRes.status);
  }
  const saved = await commitDraftPhoto(c.env, { userId: user.id, recipeId: id, photo: prepRes.photo, idGen: newId });
  const photoUrl = `/account/recipes/${esc(id)}/photo`;
  if (json) return c.json({ ok: true, id: saved.id, photoUrl, mime: saved.mime, bytes: saved.bytes, width: saved.width, height: saved.height, message: t.draftPhotoSaved }, 200, NO_STORE);
  return c.redirect(`/account/recipes/${id}/edit?saved=1${qsAmp(lang)}`, 303);
});

accountApp.post('/recipes/:id/photo/delete', async (c) => {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  const json = wantsJson(c);
  const id = c.req.param('id');
  const owned = await loadOwned(c, id);
  if (!owned) {
    if (json) return c.json({ ok: false, error: t.errDraftNotFound }, 404, NO_STORE);
    return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  }
  if (owned.r.submittedAt || owned.l.status === 'published' || owned.r.reviewStatus === 'published' || owned.r.reviewStatus === 'declined' || owned.l.status === 'rejected') {
    if (json) return c.json({ ok: false, error: t.errAlreadySent }, 409, NO_STORE);
    return page(c, t.titleSubmitted, banner('err', t.errAlreadySent), 409);
  }
  await deleteDraftPhoto(c.env, { recipeId: id, userId: user.id });
  if (json) return c.json({ ok: true, message: t.draftPhotoRemoved }, 200, NO_STORE);
  return c.redirect(`/account/recipes/${id}/edit${qs(lang)}`, 303);
});

type OwnedRow = NonNullable<Awaited<ReturnType<typeof loadOwned>>>;

/** Flag an owned draft for human review. Never publishes; needs a saved attestation (checked again in SQL). */
async function sendForReview(c: Ctx, row: OwnedRow) {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (row.r.reviewStatus === 'declined' || row.l.status === 'rejected') return page(c, t.statusDeclined, banner('err', t.declinedBanner), 409);
  if (row.r.submittedAt || row.l.status === 'published' || row.r.reviewStatus === 'published') return page(c, t.titleSubmitted, banner('ok', t.okAlreadySent), 409);
  if (!row.r.attestedAt) return page(c, t.titlePermissionNeeded, banner('err', t.errPermissionNeeded), 409);
  const now = new Date().toISOString();
  const flip = await c.env.DB.prepare(
    "UPDATE recipes SET submitted_at = ?, review_status = 'in_review', notify_lang = ? WHERE id = ? AND owner_user_id = ? AND removed_by_user_at IS NULL AND submitted_at IS NULL AND attested_at IS NOT NULL AND (review_status IS NULL OR review_status = 'needs_changes')",
  ).bind(now, lang, row.r.id, user.id).run();
  if (flip.meta.changes !== 1) return page(c, t.titleSubmitted, banner('ok', t.okAlreadySent), 409);
  if (c.env.ZELUTO_CLIENT_SECRET?.trim()) {
    const pushRes = await push2YolksContactToZeluto(zelutoConfigFromCtx(c), {
      email: user.email,
      ...(user.displayName ? { firstName: user.displayName } : {}),
      externalId: user.id,
      externalEntityType: 'user',
      stage: 'creator',
      externalUrlPath: '/account/subscribers',
      tags: ['2yolks', 'creator'],
    });
    if (pushRes.ok && pushRes.zelutoId) {
      await c.env.DB.prepare('UPDATE users SET zeluto_contact_id = ? WHERE id = ?')
        .bind(pushRes.zelutoId, user.id)
        .run()
        .catch(() => {});
    }
  }
  // The admin queue (MCP recipes.list submitted:true) is the source of truth; the email is an extra,
  // counted against the same daily mail budget as login codes.
  if (c.env.REVIEW_NOTIFY_TO && (await reserveMail(c.env.DB, 'notice', NOTICES_PER_DAY))) {
    await sendMail(c.env, {
      to: c.env.REVIEW_NOTIFY_TO,
      subject: `2yolks recipe submitted for review: ${row.l.title}`.slice(0, 180),
      text: `A recipe was sent in for review.\n\nTitle: ${row.l.title}\nRecipe id: ${row.r.id}\nAuthor shown as: ${row.r.authorName ?? user.displayName ?? ''}\nSubmitter: ${user.email}\nSource: ${row.s.name} (${row.s.url}), license label ${row.s.license}\nAuthor confirmed rights at: ${row.r.attestedAt}\n\nIt stays a private draft until you clear the source and publish it with the admin tools. Queue: MCP recipes.list with submitted:true.\n`,
    }).catch(() => false);
  }
  // data-capture-clear: the capture script drops this draft's autosaved copy from the device.
  return page(c, t.sentInPageTitle, `<h1>${t.sentInTitle}</h1><p class="lead">${fill(t.sentInLead, { title: esc(row.l.title) })}</p><p><a class="btn" href="/account${qs(lang)}">${t.backToRecipes}</a></p><div data-capture-clear="${esc(row.r.id)}" hidden></div><script>${CAPTURE_CLIENT_SCRIPT}</script>`);
}

accountApp.post('/recipes/:id/submit', async (c) => {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_SUBMIT, c, 'submit')) return page(c, t.titleSlowDown, banner('err', t.errTooManyTries), 429);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  if (!row.r.submittedAt && row.l.status !== 'published' && !row.r.attestedAt) {
    // The permission box may be ticked right on the submit action: record the
    // attestation and submit in one POST. Without it, the submit is refused.
    const form = await c.req.parseBody();
    if (str(form['attest'], 2) === '1') {
      const now = new Date().toISOString();
      const att = await c.env.DB.prepare('UPDATE recipes SET attested_at = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND attested_at IS NULL').bind(now, row.r.id, user.id).run();
      if (att.meta.changes === 1) row.r.attestedAt = now;
    }
  }
  return sendForReview(c, row);
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
  const user = c.get('user')!;
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
  const user = c.get('user')!;
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

// "Remove" never deletes data: marks removed_by_user_at (hidden from My kitchen) + locale rejected; rows stay for review/audit.
accountApp.post('/recipes/:id/delete', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const res = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE recipe_locales SET status = 'rejected' WHERE recipe_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = ? AND r.owner_user_id = ? AND r.submitted_at IS NULL AND r.removed_by_user_at IS NULL AND (r.review_status IS NULL OR r.review_status = 'needs_changes'))",
    ).bind(id, id, user.id),
    c.env.DB.prepare(
      "UPDATE recipes SET removed_by_user_at = ? WHERE id = ? AND owner_user_id = ? AND submitted_at IS NULL AND removed_by_user_at IS NULL AND (review_status IS NULL OR review_status = 'needs_changes')",
    ).bind(now, id, user.id),
  ]);
  if (res[0]!.meta.changes !== 1) return page(c, accountStrings(langOf(c)).titleNotFound, banner('err', accountStrings(langOf(c)).errDraftNotFoundOrSent), 404);
  await deleteDraftPhoto(c.env, { recipeId: id, userId: user.id });
  return c.redirect(`/account${qs(langOf(c))}`, 303);
});

accountApp.post('/recipes/:id/copy', async (c) => {
  const user = c.get('user')!;
  const lang = langOf(c);
  const t = accountStrings(lang);
  if (await limited(c.env.RL_SUBMIT, c, 'copy')) return page(c, t.titleSlowDown, banner('err', t.errTooManyTries), 429);
  const row = await loadOwned(c, c.req.param('id'));
  if (!row) return page(c, t.titleNotFound, banner('err', t.errDraftNotFound), 404);
  if (row.r.reviewStatus !== 'declined') return page(c, t.titleSubmitted, banner('err', t.errAlreadySent), 409);

  const copyId = newId();
  const copySourceId = `src-${copyId}`;
  const base = (() => { try { return slugify(row.l.title).slice(0, 100).replace(/-+$/, ''); } catch { return ''; } })() || 'recipe';
  const slug = `${base}-${copyId}`;
  const now = new Date().toISOString();
  const D = c.env.DB;
  const room = "(SELECT count(*) FROM recipes r JOIN recipe_locales l ON l.recipe_id = r.id WHERE r.owner_user_id = ? AND r.removed_by_user_at IS NULL AND l.status <> 'rejected') < ? AND (SELECT count(*) FROM recipes WHERE owner_user_id = ?) < ?";
  const res = await D.batch([
    D.prepare(`INSERT INTO sources (id,name,url,license,cleared_at,notes) SELECT ?,?,?,?,NULL,? WHERE ${room}`).bind(copySourceId, row.s.name, row.s.url, row.s.license, 'user submission - rights review pending', user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
    D.prepare(`INSERT INTO recipes (id,source_id,origin_country,image_key,created_at,prep_minutes,cook_minutes,base_servings,owner_user_id,attested_at,author_name,category) SELECT ?,?,?,NULL,?,?,?,?,?,NULL,?,? WHERE ${room}`).bind(copyId, copySourceId, row.r.originCountry ?? null, now, row.r.prepMinutes ?? null, row.r.cookMinutes ?? null, row.r.baseServings ?? null, user.id, row.r.authorName ?? user.displayName ?? null, row.r.category ?? null, user.id, MAX_DRAFTS_PER_USER, user.id, MAX_ROWS_PER_USER),
    D.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,intro,ingredients_json,steps_json,status) SELECT ?,?,?,?,?,?,?,?,'draft' WHERE EXISTS (SELECT 1 FROM recipes WHERE id = ?)").bind(copyId, row.l.country, row.l.lang, row.l.title, slug, row.l.intro ?? null, row.l.ingredientsJson, row.l.stepsJson, copyId),
  ]);
  if (res[1]!.meta.changes !== 1) {
    const life = await D.prepare('SELECT count(*) AS n FROM recipes WHERE owner_user_id = ?').bind(user.id).first<{ n: number }>();
    const msg = (life?.n ?? 0) >= MAX_ROWS_PER_USER ? t.errRowLimit : fill(t.errDraftLimit, { max: MAX_DRAFTS_PER_USER });
    return page(c, t.statusDeclined, banner('err', msg), 400);
  }
  return c.redirect(`/account/recipes/${copyId}/edit?copied=1${qsAmp(lang)}`, 303);
});

// --- Creator Subscribers & Zeluto CRM (Strict Creator Isolation) ------------

accountApp.get('/subscribers', async (c) => {
  const lang = langOf(c);
  const t = accountStrings(lang);
  const user = c.get('user');
  if (!user) {
    return c.redirect(`/account?${lang === 'en' ? '' : `lang=${lang}&`}next=${encodeURIComponent('/account/subscribers')}`, 303);
  }
  const wantsJson = (c.req.header('accept') || '').includes('application/json');
  const isCreator = await hasUserSharedRecipe(c.env.DB, user.id);
  if (!isCreator) {
    if (wantsJson) {
      return c.json({ error: 'creator_required', message: 'Share a recipe to become a Creator and unlock subscribers CRM.' }, 403);
    }
    return page(
      c,
      'Creator Subscribers',
      `<h1>Creator Subscribers</h1>${banner('err', 'Share at least one recipe to become a Creator and unlock your isolated subscriber workspace.')}<p><a class="btn" href="/account/recipes/new${qs(lang)}">Share a Recipe</a></p>`,
      403,
    );
  }

  let creatorRow = await c.env.DB.prepare(
    'SELECT zeluto_org_id, zeluto_connection_status, zeluto_contact_id FROM users WHERE id = ? LIMIT 1',
  )
    .bind(user.id)
    .first<{
      zeluto_org_id: string | null;
      zeluto_connection_status: string | null;
      zeluto_contact_id: string | null;
    }>();

  let status = (creatorRow?.zeluto_connection_status || 'not_registered') as ZelutoConnectionStatus;
  let zelutoOrgId = creatorRow?.zeluto_org_id ?? null;
  let emailSendReady = false;
  let rejectionReason: string | null = null;
  const zCfg = zelutoConfigFromCtx(c);

  if (zCfg.clientSecret?.trim() && (status === 'pending_approval' || status === 'approved')) {
    const live = await get2YolksCreatorRegistrationStatus(zCfg, user.id);
    if (live.ok && live.status) {
      status = live.status;
      if (live.zelutoOrganizationId) zelutoOrgId = live.zelutoOrganizationId;
      emailSendReady = Boolean(live.emailSendReady);
      rejectionReason = live.rejectionReason ?? null;
      if (status !== creatorRow?.zeluto_connection_status || zelutoOrgId !== (creatorRow?.zeluto_org_id ?? null)) {
        await c.env.DB.prepare('UPDATE users SET zeluto_connection_status = ?, zeluto_org_id = ? WHERE id = ?')
          .bind(status, zelutoOrgId, user.id)
          .run();
      }
    }
  }

  const subRows = await c.env.DB.prepare(
    `SELECT cs.id, sub.id AS subscriber_user_id, sub.email, sub.display_name, cs.zeluto_contact_id, cs.unsubscribed_at, cs.created_at
     FROM creator_subscribers cs
     JOIN users sub ON sub.id = cs.subscriber_user_id
     WHERE cs.creator_user_id = ?
     ORDER BY cs.created_at DESC
     LIMIT 200`,
  )
    .bind(user.id)
    .all<Record<string, unknown>>();

  const approved = status === 'approved' && Boolean(zelutoOrgId);
  const links = build2YolksZelutoLinks(zCfg, approved ? zelutoOrgId : null);
  const subscribers = (subRows.results ?? []).map((r) => ({
    id: String(r.id),
    subscriberUserId: String(r.subscriber_user_id),
    email: String(r.email),
    displayName: r.display_name ? String(r.display_name) : null,
    zelutoContactId: r.zeluto_contact_id ? String(r.zeluto_contact_id) : null,
    unsubscribedAt: r.unsubscribed_at ? String(r.unsubscribed_at) : null,
    createdAt: String(r.created_at),
  }));

  if (wantsJson) {
    return c.json({
      ok: true,
      isCreator: true,
      zelutoStatus: status,
      zelutoOrgId: approved ? zelutoOrgId : null,
      emailSendReady: approved ? emailSendReady : false,
      subscribersUrl: links.subscribersUrl,
      workspaceUrl: links.workspaceUrl,
      deliverySetupUrl: links.deliverySetupUrl,
      rejectionReason,
      subscribers,
    });
  }

  const subList = subscribers.length
    ? `<ul class="mine">${subscribers
        .map(
          (s) =>
            `<li><span><strong>${esc(s.displayName || s.email)}</strong> (${esc(s.email)})</span><span class="badge">${s.unsubscribedAt ? 'Unsubscribed' : 'Subscribed'}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="hint">No creator subscribers yet.</p>';

  const zelutoPanel = approved
    ? `<div class="panel"><h2>Zeluto Creator Workspace</h2>
        <p><a class="btn" href="${esc(links.subscribersUrl!)}" target="_blank" rel="noopener noreferrer">Open My Subscribers in Zeluto &#8599;</a></p>
        ${
          !emailSendReady
            ? `${banner('err', `Read-only CRM access: configure your own Resend API key &amp; verified domain in Zeluto before sending emails back. <a href="${esc(links.deliverySetupUrl!)}" target="_blank" rel="noopener noreferrer">Configure Resend in Zeluto &#8599;</a>`)}`
            : `<p>Resend configured. <a href="${esc(links.deliverySetupUrl!)}" target="_blank" rel="noopener noreferrer">Manage Resend &#8599;</a></p>`
        }
      </div>`
    : status === 'pending_approval'
      ? `<div class="panel"><h2>Zeluto Creator Workspace</h2><p class="badge">Pending Zeluto Super-Admin Approval</p><p class="hint">Your creator CRM workspace request is awaiting approval by a Zeluto Platform Super-Administrator.</p></div>`
      : `<div class="panel"><h2>Zeluto Creator Workspace</h2><p>Connect an isolated Zeluto workspace to view your creator subscribers and send updates using your own Resend key &amp; domain.</p>
          <form method="post" action="/account/zeluto/register${qs(lang)}"><button class="btn" type="submit">Request Zeluto Creator Workspace</button></form>
        </div>`;

  return page(
    c,
    'Creator Subscribers',
    `<h1>Creator Subscribers</h1>
<p class="lead">Only readers subscribed to your shared recipes appear here.</p>
${zelutoPanel}
<div class="panel"><h2>Your Subscribers (${subscribers.length})</h2>${subList}</div>
<p><a href="/account${qs(lang)}">${t.backToRecipes}</a></p>`,
  );
});

accountApp.post('/zeluto/register', async (c) => {
  const lang = langOf(c);
  const user = c.get('user');
  const wantsJson = (c.req.header('accept') || '').includes('application/json');
  if (!user) {
    return wantsJson ? c.json({ error: 'unauthorized' }, 401) : c.redirect(`/account?next=%2Faccount%2Fsubscribers`, 303);
  }
  const isCreator = await hasUserSharedRecipe(c.env.DB, user.id);
  if (!isCreator) {
    if (wantsJson) {
      return c.json({ error: 'creator_required', message: 'Share a recipe first to become a Creator.' }, 403);
    }
    return page(c, 'Creator CRM', banner('err', 'Share a recipe first to unlock Creator Zeluto CRM.'), 403);
  }
  const zCfg = zelutoConfigFromCtx(c);
  const reg = await request2YolksCreatorRegistration(zCfg, {
    creatorId: user.id,
    creatorName: user.displayName || user.email,
    adminEmail: user.email,
  });
  if (!reg.ok) {
    return wantsJson
      ? c.json({ error: reg.error ?? 'registration_failed' }, 502)
      : page(c, 'Creator CRM', banner('err', esc(reg.error ?? 'Failed to register with Zeluto')), 400);
  }
  const status = reg.status ?? 'pending_approval';
  await c.env.DB.prepare('UPDATE users SET zeluto_connection_status = ?, zeluto_org_id = ? WHERE id = ?')
    .bind(status, reg.zelutoOrganizationId ?? null, user.id)
    .run();
  const approved = status === 'approved' && Boolean(reg.zelutoOrganizationId);
  const links = build2YolksZelutoLinks(zCfg, approved ? reg.zelutoOrganizationId : null);
  if (wantsJson) {
    return c.json(
      {
        ok: true,
        status,
        zelutoOrgId: approved ? reg.zelutoOrganizationId : null,
        subscribersUrl: links.subscribersUrl,
        deliverySetupUrl: links.deliverySetupUrl,
      },
      approved ? 200 : 202,
    );
  }
  return c.redirect(`/account/subscribers${qs(lang)}`, 303);
});

accountApp.post('/creators/:creatorId/subscribe', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const creatorId = c.req.param('creatorId').trim();
  if (!creatorId || creatorId === user.id) {
    return c.json({ error: 'invalid_creator' }, 400);
  }
  const creatorHasShared = await hasUserSharedRecipe(c.env.DB, creatorId);
  if (!creatorHasShared) {
    return c.json({ error: 'creator_not_found', message: 'User is not a recipe Creator yet.' }, 403);
  }
  const creatorRow = await c.env.DB.prepare(
    'SELECT id, zeluto_org_id, zeluto_connection_status FROM users WHERE id = ? LIMIT 1',
  )
    .bind(creatorId)
    .first<{ id: string; zeluto_org_id: string | null; zeluto_connection_status: string | null }>();
  if (!creatorRow) return c.json({ error: 'creator_not_found' }, 404);

  const nowIso = new Date().toISOString();
  const subRowId = `cs_${newId()}`;
  await c.env.DB.prepare(
    `INSERT INTO creator_subscribers (id, creator_user_id, subscriber_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(creator_user_id, subscriber_user_id) DO UPDATE SET
       unsubscribed_at = NULL,
       zeluto_pushed_at = NULL,
       updated_at = excluded.updated_at`,
  )
    .bind(subRowId, creatorId, user.id, nowIso, nowIso)
    .run();

  const saved = await c.env.DB.prepare(
    'SELECT id, zeluto_contact_id FROM creator_subscribers WHERE creator_user_id = ? AND subscriber_user_id = ? LIMIT 1',
  )
    .bind(creatorId, user.id)
    .first<{ id: string; zeluto_contact_id: string | null }>();
  const effectiveId = saved?.id ?? subRowId;
  let zelutoContactId = saved?.zeluto_contact_id ?? null;
  let syncedToCreatorWorkspace = false;

  if (
    c.env.ZELUTO_CLIENT_SECRET?.trim() &&
    creatorRow.zeluto_connection_status === 'approved' &&
    creatorRow.zeluto_org_id
  ) {
    const pushRes = await push2YolksContactToZeluto(
      zelutoConfigFromCtx(c),
      {
        email: user.email,
        ...(user.displayName ? { firstName: user.displayName } : {}),
        externalId: effectiveId,
        externalEntityType: 'creator_subscriber',
        stage: 'subscriber',
        externalUrlPath: '/account/subscribers',
        tags: ['2yolks', 'creator-subscriber', `creator:${creatorId}`],
      },
      creatorRow.zeluto_org_id,
    );
    if (pushRes.ok) {
      syncedToCreatorWorkspace = true;
      if (pushRes.zelutoId) {
        zelutoContactId = pushRes.zelutoId;
        await c.env.DB.prepare(
          'UPDATE creator_subscribers SET zeluto_contact_id = ?, zeluto_pushed_at = ?, updated_at = ? WHERE id = ?',
        )
          .bind(pushRes.zelutoId, new Date().toISOString(), new Date().toISOString(), effectiveId)
          .run();
      }
    }
  }

  return c.json(
    {
      ok: true,
      subscriptionId: effectiveId,
      creatorUserId: creatorId,
      subscriberUserId: user.id,
      zelutoContactId,
      syncedToCreatorWorkspace,
    },
    201,
  );
});
