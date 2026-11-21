// S10: WebAuthn Passkeys + env-gated Google OAuth 2.0 (OIDC PKCE).
// Mounted onto accountApp without circular imports via registerAuthMethodRoutes.
import type { Context, Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { accountStrings, fill, isAccountLang, type AccountStrings } from '@2yolks/contracts';

export const MAX_PASSKEYS_PER_USER = 10;
export const AUTH_CHALLENGE_TTL_MS = 5 * 60_000;
export const GOOGLE_STATE_COOKIE = '2y_gstate';
const NO_STORE = { 'cache-control': 'no-store' } as const;

export type AuthMethodsEnv = {
  DB: D1Database;
  CANONICAL_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RL_AUTH?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
};

export type PasskeySummary = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export interface AuthMethodsDeps<Ctx extends Context<any>> {
  safeNextPath: (raw: unknown) => string | null;
  normEmail: (raw: unknown) => string | null;
  str: (raw: unknown, max?: number) => string;
  newId: () => string;
  randomToken: () => string;
  sha256Hex: (s: string) => Promise<string>;
  cleanupExpired: (db: D1Database, now: number) => Promise<void>;
  limited: (rl: AuthMethodsEnv['RL_AUTH'], c: Ctx, scope: string) => Promise<boolean>;
  readBody: (c: Ctx) => Promise<Record<string, unknown>>;
  wantsJson: (c: Ctx) => boolean;
  page: (c: Ctx, title: string, body: string, status?: 200 | 400 | 403 | 404 | 409 | 429 | 503, nextOverride?: string | null, wide?: boolean) => Response | Promise<Response>;
  renderSignIn: (t: AccountStrings, lang: string, msg: string, next: string | null, googleEnabled: boolean) => string;
  issueUserSession: (c: Ctx, user: { id: string; email: string }, next: string | null, lang: string, json: boolean) => Promise<Response>;
}

export function googleOAuthEnabled(env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

type Bytes = Uint8Array<ArrayBuffer>;

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(raw: unknown): Bytes | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 16_384 || !/^[A-Za-z0-9_-]+={0,2}$/.test(trimmed)) return null;
  const clean = trimmed.replace(/=+$/, '');
  if (clean.length % 4 === 1) return null;
  const b64 = clean.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (clean.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function readAsn1Int32(bytes: Uint8Array, offset: number, end: number): { value: Uint8Array; next: number } | null {
  if (offset + 2 > end || bytes[offset] !== 0x02) return null;
  const len = bytes[offset + 1]!;
  const start = offset + 2;
  if (len === 0 || len >= 0x80 || start + len > end) return null;
  let slice = bytes.subarray(start, start + len);
  if (slice[0] === 0x00 && slice.length > 1) slice = slice.subarray(1);
  if (slice.length > 32) return null;
  return { value: slice, next: start + len };
}

/** Convert an ASN.1 DER ECDSA (P-256) signature into 64-byte IEEE P1363 format for Web Crypto. */
export function derEcdsaToP1363(der: Uint8Array): Bytes | null {
  if (der.byteLength < 8 || der[0] !== 0x30) return null;
  let offset = 2;
  let seqLen = der[1]!;
  if (seqLen === 0x81) {
    if (der.byteLength < 9) return null;
    seqLen = der[2]!;
    offset = 3;
  } else if (seqLen >= 0x80) {
    return null;
  }
  const seqEnd = offset + seqLen;
  if (seqEnd !== der.byteLength) return null;
  const r = readAsn1Int32(der, offset, seqEnd);
  if (!r) return null;
  const s = readAsn1Int32(der, r.next, seqEnd);
  if (!s || s.next !== seqEnd) return null;
  const out = new Uint8Array(64);
  out.set(r.value, 32 - r.value.length);
  out.set(s.value, 64 - s.value.length);
  return out;
}

export function expectedOriginAndRpId(reqUrl: string, canonicalOrigin?: string): { origin: string; rpId: string } {
  const reqOriginUrl = new URL(reqUrl);
  if (reqOriginUrl.hostname === 'localhost' || reqOriginUrl.hostname === '127.0.0.1') {
    return { origin: reqOriginUrl.origin, rpId: reqOriginUrl.hostname };
  }
  if (canonicalOrigin) {
    try {
      const canUrl = new URL(canonicalOrigin);
      return { origin: canUrl.origin, rpId: canUrl.hostname };
    } catch { /* fall back to request origin */ }
  }
  return { origin: reqOriginUrl.origin, rpId: reqOriginUrl.hostname };
}

export async function verifyAuthenticatorData(
  authData: Uint8Array,
  expectedRpId: string,
  requireAttestedCred?: Uint8Array,
): Promise<{ signCount: number } | null> {
  if (authData.byteLength < 37) return null;
  const expectedRpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId)));
  if (!bytesEqual(authData.subarray(0, 32), expectedRpHash)) return null;
  const flags = authData[32]!;
  const userPresent = (flags & 0x01) !== 0;
  if (!userPresent) return null;
  const backupEligible = (flags & 0x08) !== 0;
  const backupState = (flags & 0x10) !== 0;
  if (!backupEligible && backupState) return null;
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
  const signCount = view.getUint32(33, false);
  const hasAttested = (flags & 0x40) !== 0;
  if (requireAttestedCred) {
    if (!hasAttested || authData.byteLength < 55) return null;
    const credIdLen = view.getUint16(53, false);
    if (credIdLen <= 0 || authData.byteLength < 55 + credIdLen) return null;
    const attestedId = authData.subarray(55, 55 + credIdLen);
    if (!bytesEqual(attestedId, requireAttestedCred)) return null;
  }
  return { signCount };
}

function parseClientData(
  clientDataBytes: Uint8Array,
  expectedType: 'webauthn.create' | 'webauthn.get',
  expectedChallenge: string,
  expectedOrigin: string,
): boolean {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(clientDataBytes)) as {
      type?: unknown;
      challenge?: unknown;
      origin?: unknown;
    };
    return parsed?.type === expectedType && parsed.challenge === expectedChallenge && parsed.origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function importPasskeyKey(spkiBytes: Bytes, coseAlg: number): Promise<CryptoKey | null> {
  try {
    if (coseAlg === -7) {
      return await crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    }
    if (coseAlg === -257) {
      return await crypto.subtle.importKey('spki', spkiBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    }
    return null;
  } catch {
    return null;
  }
}

async function verifyPasskeySignature(
  spkiBytes: Bytes,
  coseAlg: number,
  sigBytes: Bytes,
  authData: Bytes,
  clientDataBytes: Bytes,
): Promise<boolean> {
  const key = await importPasskeyKey(spkiBytes, coseAlg);
  if (!key) return false;
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
  const signedPayload = new Uint8Array(authData.byteLength + clientHash.byteLength);
  signedPayload.set(authData, 0);
  signedPayload.set(clientHash, authData.byteLength);
  if (coseAlg === -7) {
    const p1363 = derEcdsaToP1363(sigBytes);
    if (!p1363) return false;
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, p1363, signedPayload);
  }
  if (coseAlg === -257) {
    return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sigBytes, signedPayload);
  }
  return false;
}

export async function loadUserPasskeys(db: D1Database, userId: string): Promise<PasskeySummary[]> {
  try {
    const res = await db
      .prepare('SELECT id, label, created_at AS createdAt, last_used_at AS lastUsedAt FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(userId, MAX_PASSKEYS_PER_USER)
      .all<{ id: string; label: string | null; createdAt: string; lastUsedAt: string | null }>();
    return (res.results ?? []).map((row) => ({
      id: String(row.id),
      label: row.label?.trim() || 'Passkey',
      createdAt: String(row.createdAt),
      lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
    }));
  } catch {
    return [];
  }
}

function decodeJwtPayload(jwt: unknown): Record<string, unknown> | null {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const payloadBytes = fromBase64Url(parts[1]);
  if (!payloadBytes) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(payloadBytes));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function registerAuthMethodRoutes<E extends { Bindings: AuthMethodsEnv & Record<string, any>; Variables: { user: { id: string; email: string; displayName: string | null } | null } }>(
  app: Hono<E>,
  deps: AuthMethodsDeps<Context<E>>,
) {
  const getLang = (c: Context<E>) => {
    const l = c.req.query('lang');
    return isAccountLang(l) ? l : 'en';
  };
  const qs = (lang: string) => (lang === 'en' ? '' : `?lang=${lang}`);

  async function consumeChallenge(
    db: D1Database,
    id: string,
    kind: 'passkey_reg' | 'passkey_auth' | 'google_oidc',
    now: number,
    userId?: string,
  ): Promise<{ challenge: string; next_path: string | null; lang: string } | null> {
    const sql = userId
      ? 'SELECT challenge, next_path, lang FROM auth_challenges WHERE id = ? AND kind = ? AND user_id = ? AND used = 0 AND expires_at > ?'
      : 'SELECT challenge, next_path, lang FROM auth_challenges WHERE id = ? AND kind = ? AND used = 0 AND expires_at > ?';
    const row = userId
      ? await db.prepare(sql).bind(id, kind, userId, now).first<{ challenge: string; next_path: string | null; lang: string }>()
      : await db.prepare(sql).bind(id, kind, now).first<{ challenge: string; next_path: string | null; lang: string }>();
    if (!row) return null;
    const updSql = userId
      ? 'UPDATE auth_challenges SET used = 1 WHERE id = ? AND kind = ? AND user_id = ? AND used = 0 AND expires_at > ?'
      : 'UPDATE auth_challenges SET used = 1 WHERE id = ? AND kind = ? AND used = 0 AND expires_at > ?';
    const upd = userId
      ? await db.prepare(updSql).bind(id, kind, userId, now).run()
      : await db.prepare(updSql).bind(id, kind, now).run();
    if (upd.meta.changes !== 1) return null;
    return row;
  }

  // --- Passkey Registration (signed in) -------------------------------------

  app.post('/passkey/register/options', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    const user = c.get('user');
    if (!user) return c.json({ ok: false, error: t.signInPageTitle }, 401, NO_STORE);
    if (await deps.limited(c.env.RL_AUTH, c, 'passkey_reg')) {
      return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    }
    const existing = await loadUserPasskeys(c.env.DB, user.id);
    if (existing.length >= MAX_PASSKEYS_PER_USER) {
      return c.json({ ok: false, error: fill(t.errPasskeyLimit, { max: MAX_PASSKEYS_PER_USER }) }, 400, NO_STORE);
    }
    const now = Date.now();
    await deps.cleanupExpired(c.env.DB, now);
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challengeId = deps.newId() + deps.newId();
    await c.env.DB
      .prepare('INSERT INTO auth_challenges (id, kind, challenge, user_id, next_path, lang, expires_at, used, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?)')
      .bind(challengeId, 'passkey_reg', challenge, user.id, lang, now + AUTH_CHALLENGE_TTL_MS, now)
      .run();
    const { rpId } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    return c.json(
      {
        ok: true,
        challengeId,
        options: {
          challenge,
          rp: { name: '2yolks', id: rpId },
          user: {
            id: toBase64Url(new TextEncoder().encode(user.id)),
            name: user.email,
            displayName: user.displayName || user.email,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60_000,
          attestation: 'none',
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
          excludeCredentials: existing.map((k) => ({ id: k.id, type: 'public-key' })),
        },
      },
      200,
      NO_STORE,
    );
  });

  app.post('/passkey/register/verify', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    const user = c.get('user');
    if (!user) return c.json({ ok: false, error: t.signInPageTitle }, 401, NO_STORE);
    if (await deps.limited(c.env.RL_AUTH, c, 'passkey_reg')) {
      return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    }
    const body = await deps.readBody(c);
    const challengeId = deps.str(body['challengeId'], 64).trim();
    const credentialId = deps.str(body['credentialId'], 512).trim();
    const clientDataBytes = fromBase64Url(body['clientDataJSON']);
    const authDataBytes = fromBase64Url(body['authenticatorData']);
    const spkiBytes = fromBase64Url(body['publicKeySpki']);
    const coseAlg = typeof body['coseAlg'] === 'number' ? body['coseAlg'] : Number(body['coseAlg']);
    const credIdBytes = fromBase64Url(credentialId);
    if (!challengeId || !credentialId || !credIdBytes || credIdBytes.byteLength < 16 || !clientDataBytes || !authDataBytes || !spkiBytes) {
      return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);
    }

    const now = Date.now();
    const ch = await consumeChallenge(c.env.DB, challengeId, 'passkey_reg', now, user.id);
    if (!ch) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const { origin, rpId } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    if (!parseClientData(clientDataBytes, 'webauthn.create', ch.challenge, origin)) {
      return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);
    }
    const verifiedAuth = await verifyAuthenticatorData(authDataBytes, rpId, credIdBytes);
    if (!verifiedAuth) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const key = await importPasskeyKey(spkiBytes, coseAlg);
    if (!key) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const countRow = await c.env.DB
      .prepare('SELECT count(*) AS n FROM user_passkeys WHERE user_id = ?')
      .bind(user.id)
      .first<{ n: number }>();
    if ((countRow?.n ?? 0) >= MAX_PASSKEYS_PER_USER) {
      return c.json({ ok: false, error: fill(t.errPasskeyLimit, { max: MAX_PASSKEYS_PER_USER }) }, 400, NO_STORE);
    }

    const conflict = await c.env.DB
      .prepare('SELECT user_id FROM user_passkeys WHERE id = ? LIMIT 1')
      .bind(credentialId)
      .first<{ user_id: string }>();
    if (conflict) return c.json({ ok: false, error: t.errPasskeyFailed }, 409, NO_STORE);

    const nowIso = new Date().toISOString();
    const rawLabel = deps.str(body['label'], 60).trim();
    const label = rawLabel || fill(t.passkeyDefaultLabel, { date: nowIso.slice(0, 10) });
    const rawTransports = Array.isArray(body['transports'])
      ? body['transports'].filter((x): x is string => typeof x === 'string' && /^[a-z0-9-]{1,24}$/.test(x)).slice(0, 6)
      : [];

    await c.env.DB
      .prepare('INSERT INTO user_passkeys (id, user_id, public_key_spki, cose_alg, sign_count, transports, label, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)')
      .bind(credentialId, user.id, toBase64Url(spkiBytes), coseAlg, verifiedAuth.signCount, rawTransports.length ? JSON.stringify(rawTransports) : null, label, nowIso)
      .run();

    return c.json(
      { ok: true, passkey: { id: credentialId, label, createdAt: nowIso, lastUsedAt: null } },
      200,
      NO_STORE,
    );
  });

  app.post('/passkey/:id/delete', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    const user = c.get('user');
    if (!user) {
      return deps.wantsJson(c) ? c.json({ ok: false, error: t.signInPageTitle }, 401, NO_STORE) : c.redirect(`/account${qs(lang)}`, 303);
    }
    const id = c.req.param('id').trim();
    if (!id || id.length > 512) {
      return deps.wantsJson(c) ? c.json({ ok: false, error: t.errGeneric }, 400, NO_STORE) : c.redirect(`/account${qs(lang)}`, 303);
    }
    await c.env.DB.prepare('DELETE FROM user_passkeys WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    if (deps.wantsJson(c)) return c.json({ ok: true }, 200, NO_STORE);
    return c.redirect(`/account${qs(lang)}`, 303);
  });

  // --- Passkey Sign-in (anonymous) ------------------------------------------

  app.post('/passkey/login/options', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    if (await deps.limited(c.env.RL_AUTH, c, 'passkey_login')) {
      return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    }
    const body = await deps.readBody(c);
    const nextPath = deps.safeNextPath(body['next']) ?? deps.safeNextPath(c.req.query('next'));
    const now = Date.now();
    await deps.cleanupExpired(c.env.DB, now);
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challengeId = deps.newId() + deps.newId();
    await c.env.DB
      .prepare('INSERT INTO auth_challenges (id, kind, challenge, user_id, next_path, lang, expires_at, used, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?)')
      .bind(challengeId, 'passkey_auth', challenge, nextPath, lang, now + AUTH_CHALLENGE_TTL_MS, now)
      .run();
    const { rpId } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    return c.json(
      {
        ok: true,
        challengeId,
        options: {
          challenge,
          rpId,
          timeout: 60_000,
          userVerification: 'preferred',
        },
      },
      200,
      NO_STORE,
    );
  });

  app.post('/passkey/login/verify', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    if (await deps.limited(c.env.RL_AUTH, c, 'passkey_login')) {
      return c.json({ ok: false, error: t.errTooManyTries }, 429, NO_STORE);
    }
    const body = await deps.readBody(c);
    const challengeId = deps.str(body['challengeId'], 64).trim();
    const credentialId = deps.str(body['credentialId'], 512).trim();
    const clientDataBytes = fromBase64Url(body['clientDataJSON']);
    const authDataBytes = fromBase64Url(body['authenticatorData']);
    const sigBytes = fromBase64Url(body['signature']);
    if (!challengeId || !credentialId || !clientDataBytes || !authDataBytes || !sigBytes) {
      return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);
    }

    const now = Date.now();
    const ch = await consumeChallenge(c.env.DB, challengeId, 'passkey_auth', now);
    if (!ch) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const pk = await c.env.DB
      .prepare('SELECT p.id, p.user_id AS userId, p.public_key_spki AS publicKeySpki, p.cose_alg AS coseAlg, p.sign_count AS signCount, u.email AS email FROM user_passkeys p JOIN users u ON u.id = p.user_id WHERE p.id = ? LIMIT 1')
      .bind(credentialId)
      .first<{ id: string; userId: string; publicKeySpki: string; coseAlg: number; signCount: number; email: string }>();
    if (!pk) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const spkiBytes = fromBase64Url(pk.publicKeySpki);
    if (!spkiBytes) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    const { origin, rpId } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    if (!parseClientData(clientDataBytes, 'webauthn.get', ch.challenge, origin)) {
      return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);
    }
    const verifiedAuth = await verifyAuthenticatorData(authDataBytes, rpId);
    if (!verifiedAuth) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    if (pk.signCount > 0 && verifiedAuth.signCount > 0 && verifiedAuth.signCount <= pk.signCount) {
      return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);
    }

    const sigOk = await verifyPasskeySignature(spkiBytes, pk.coseAlg, sigBytes, authDataBytes, clientDataBytes);
    if (!sigOk) return c.json({ ok: false, error: t.errPasskeyFailed }, 400, NO_STORE);

    await c.env.DB
      .prepare('UPDATE user_passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?')
      .bind(Math.max(pk.signCount, verifiedAuth.signCount), new Date().toISOString(), pk.id)
      .run();

    const effLang = isAccountLang(ch.lang) ? ch.lang : lang;
    return deps.issueUserSession(c, { id: pk.userId, email: pk.email }, ch.next_path, effLang, true);
  });

  // --- Env-gated Google OAuth 2.0 / OIDC PKCE -------------------------------

  app.get('/google/start', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    const nextPath = deps.safeNextPath(c.req.query('next'));
    const gEnabled = googleOAuthEnabled(c.env);
    if (!gEnabled) {
      return deps.page(
        c,
        t.signInPageTitle,
        deps.renderSignIn(t, lang, `<div class="err" role="alert">${t.errGoogleOff}</div>`, nextPath, false),
        503,
        nextPath,
      );
    }
    if (await deps.limited(c.env.RL_AUTH, c, 'google')) {
      return deps.page(
        c,
        t.titleSlowDown,
        deps.renderSignIn(t, lang, `<div class="err" role="alert">${t.errTooManyTries}</div>`, nextPath, true),
        429,
        nextPath,
      );
    }

    const now = Date.now();
    await deps.cleanupExpired(c.env.DB, now);
    const rawState = deps.randomToken();
    const stateHash = await deps.sha256Hex(rawState);
    const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const codeChallenge = toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))));

    await c.env.DB
      .prepare('INSERT INTO auth_challenges (id, kind, challenge, user_id, next_path, lang, expires_at, used, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?)')
      .bind(stateHash, 'google_oidc', codeVerifier, nextPath, lang, now + AUTH_CHALLENGE_TTL_MS, now)
      .run();

    const reqUrl = new URL(c.req.url);
    const { origin } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    const redirectUri = `${origin}/account/google/callback`;
    const isHttps = reqUrl.protocol === 'https:';
    setCookie(c, GOOGLE_STATE_COOKIE, rawState, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'Lax',
      path: '/account/google/callback',
      maxAge: 600,
    });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID!.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', rawState);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('prompt', 'select_account');
    return c.redirect(authUrl.toString(), 302);
  });

  app.get('/google/callback', async (c) => {
    const lang = getLang(c);
    const t = accountStrings(lang);
    const reqUrl = new URL(c.req.url);
    const isHttps = reqUrl.protocol === 'https:';
    const cookieState = getCookie(c, GOOGLE_STATE_COOKIE);
    deleteCookie(c, GOOGLE_STATE_COOKIE, { path: '/account/google/callback', secure: isHttps });

    const gEnabled = googleOAuthEnabled(c.env);
    if (!gEnabled) {
      return deps.page(c, t.signInPageTitle, deps.renderSignIn(t, lang, `<div class="err" role="alert">${t.errGoogleOff}</div>`, null, false), 503, null);
    }

    const oauthErr = c.req.query('error');
    const code = c.req.query('code')?.trim() ?? '';
    const state = c.req.query('state')?.trim() ?? '';
    const fail = (status: 400 | 429 | 503, msg: string, nextOverride: string | null = null, errLang = lang) =>
      deps.page(c, t.signInPageTitle, deps.renderSignIn(accountStrings(errLang), errLang, `<div class="err" role="alert">${msg}</div>`, nextOverride, true), status, nextOverride);

    if (await deps.limited(c.env.RL_AUTH, c, 'google')) {
      return fail(429, t.errTooManyTries);
    }
    if (oauthErr || !code || !state || !cookieState || state !== cookieState) {
      return fail(400, t.errGoogleFailed);
    }

    const now = Date.now();
    const stateHash = await deps.sha256Hex(state);
    const ch = await consumeChallenge(c.env.DB, stateHash, 'google_oidc', now);
    if (!ch) return fail(400, t.errGoogleFailed);

    const effLang = isAccountLang(ch.lang) ? ch.lang : lang;
    const effT = accountStrings(effLang);
    const { origin } = expectedOriginAndRpId(c.req.url, c.env.CANONICAL_ORIGIN);
    const redirectUri = `${origin}/account/google/callback`;

    let tokenData: { access_token?: unknown; id_token?: unknown } | null = null;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.env.GOOGLE_CLIENT_ID!.trim(),
          client_secret: c.env.GOOGLE_CLIENT_SECRET!.trim(),
          code,
          code_verifier: ch.challenge,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenRes.ok) return fail(400, effT.errGoogleFailed, ch.next_path, effLang);
      tokenData = (await tokenRes.json()) as { access_token?: unknown; id_token?: unknown };
    } catch {
      return fail(503, effT.errGoogleFailed, ch.next_path, effLang);
    }

    const accessToken = typeof tokenData?.access_token === 'string' ? tokenData.access_token : '';
    const idClaims = decodeJwtPayload(tokenData?.id_token);
    if (!accessToken || !idClaims) return fail(400, effT.errGoogleFailed, ch.next_path, effLang);

    const issOk = idClaims['iss'] === 'https://accounts.google.com' || idClaims['iss'] === 'accounts.google.com';
    const audOk = idClaims['aud'] === c.env.GOOGLE_CLIENT_ID!.trim();
    const expOk = typeof idClaims['exp'] === 'number' && idClaims['exp'] > Math.floor(now / 1000);
    const idSub = typeof idClaims['sub'] === 'string' ? idClaims['sub'].trim() : '';
    if (!issOk || !audOk || !expOk || !idSub) return fail(400, effT.errGoogleFailed, ch.next_path, effLang);

    let infoData: { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown } | null = null;
    try {
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!infoRes.ok) return fail(400, effT.errGoogleFailed, ch.next_path, effLang);
      infoData = (await infoRes.json()) as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown };
    } catch {
      return fail(503, effT.errGoogleFailed, ch.next_path, effLang);
    }

    const sub = typeof infoData?.sub === 'string' ? infoData.sub.trim() : '';
    const email = deps.normEmail(infoData?.email);
    if (!sub || sub !== idSub || infoData?.email_verified !== true || !email) {
      return fail(400, effT.errGoogleFailed, ch.next_path, effLang);
    }

    let user: { id: string; email: string } | null = null;
    const linked = await c.env.DB
      .prepare("SELECT u.id AS id, u.email AS email FROM user_oauth_accounts o JOIN users u ON u.id = o.user_id WHERE o.provider = 'google' AND o.provider_sub = ? LIMIT 1")
      .bind(sub)
      .first<{ id: string; email: string }>();
    if (linked) {
      user = linked;
    } else {
      user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(email).first<{ id: string; email: string }>();
      const nowIso = new Date().toISOString();
      if (!user) {
        const displayName = typeof infoData?.name === 'string' && infoData.name.trim() ? infoData.name.trim().slice(0, 60) : null;
        await c.env.DB
          .prepare('INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)')
          .bind(deps.newId(), email, displayName, nowIso)
          .run();
        user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(email).first<{ id: string; email: string }>();
      }
      if (!user) return fail(503, effT.errGeneric, ch.next_path, effLang);
      await c.env.DB
        .prepare('INSERT OR IGNORE INTO user_oauth_accounts (provider, provider_sub, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('google', sub, user.id, email, nowIso)
        .run();
    }

    return deps.issueUserSession(c, user, ch.next_path, effLang, false);
  });
}
