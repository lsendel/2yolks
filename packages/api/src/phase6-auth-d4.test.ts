import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { migratedD1All } from './testd1';
import app from './index';
import { codesPerDay, CODES_PER_DAY } from './account';

const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;

let DB: D1Database;
let sent: { to: string[]; subject: string; text: string }[];

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB,
    IMAGES: {},
    ASSETS: { fetch: async () => new Response('no asset', { status: 404 }) },
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM: '2yolks <noreply@2yolks.com>',
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: ORIGIN,
    ...extra,
  };
}

function b64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function asn1IntFromBytes(raw: Uint8Array): Uint8Array {
  let i = 0;
  while (i < raw.length - 1 && raw[i] === 0) i++;
  let trimmed = raw.subarray(i);
  if (trimmed[0]! & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded.set(trimmed, 1);
    trimmed = padded;
  }
  const out = new Uint8Array(2 + trimmed.length);
  out[0] = 0x02;
  out[1] = trimmed.length;
  out.set(trimmed, 2);
  return out;
}

function p1363ToDer(sig: Uint8Array): Uint8Array {
  const r = asn1IntFromBytes(sig.subarray(0, 32));
  const s = asn1IntFromBytes(sig.subarray(32, 64));
  const seq = new Uint8Array(2 + r.length + s.length);
  seq[0] = 0x30;
  seq[1] = r.length + s.length;
  seq.set(r, 2);
  seq.set(s, 2 + r.length);
  return seq;
}

async function buildAuthData(rpId: string, flags: number, signCount: number, credId?: Uint8Array): Promise<Uint8Array> {
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  const extraLen = credId ? 16 + 2 + credId.length : 0;
  const buf = new Uint8Array(37 + extraLen);
  buf.set(rpHash, 0);
  buf[32] = flags;
  new DataView(buf.buffer).setUint32(33, signCount, false);
  if (credId) {
    new DataView(buf.buffer).setUint16(53, credId.length, false);
    buf.set(credId, 55);
  }
  return buf;
}

async function signInByCode(email = 'cook@example.com'): Promise<string> {
  const env = makeEnv();
  const r1 = await app.request(
    `${ORIGIN}/account/code`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email }),
    },
    env,
  );
  expect(r1.status).toBe(200);
  const code = /(\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;
  const r2 = await app.request(
    `${ORIGIN}/account/verify`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, code }),
    },
    env,
  );
  expect(r2.status).toBe(200);
  const setCookie = r2.headers.get('set-cookie') ?? '';
  return /(__Host-2y_sid=[0-9a-f]+)/.exec(setCookie)![1]!;
}

beforeEach(() => {
  DB = migratedD1All();
  sent = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Phase 6 follow-ups: S10 passkeys, env-gated Google OAuth, CODES_PER_DAY=80, D4 badge flip', () => {
  it('CODES_PER_DAY defaults to 80', () => {
    expect(CODES_PER_DAY).toBe(80);
    expect(codesPerDay({})).toBe(80);
  });

  it('S10 WebAuthn passkeys: registers P-256 passkey, prevents challenge replay, signs in, enforces signCount & deletes', async () => {
    const cookie = await signInByCode('passkey@example.com');
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spkiBytes = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    const credIdBytes = crypto.getRandomValues(new Uint8Array(24));
    const credId = b64u(credIdBytes);

    // 1. Get registration options
    const optRes = await app.request(
      `${ORIGIN}/account/passkey/register/options`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' },
        body: '{}',
      },
      makeEnv(),
    );
    expect(optRes.status).toBe(200);
    const optJson = (await optRes.json()) as { ok: boolean; challengeId: string; options: { challenge: string; rp: { id: string } } };
    expect(optJson.ok).toBe(true);
    expect(optJson.options.rp.id).toBe('2yolks.com');

    // 2. Verify registration (UP=0x01 | AT=0x40 = 0x41)
    const regClientData = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', challenge: optJson.options.challenge, origin: ORIGIN }));
    const regAuthData = await buildAuthData('2yolks.com', 0x41, 0, credIdBytes);
    const regBody = {
      challengeId: optJson.challengeId,
      credentialId: credId,
      clientDataJSON: b64u(regClientData),
      authenticatorData: b64u(regAuthData),
      publicKeySpki: b64u(spkiBytes),
      coseAlg: -7,
      label: 'MacBook Touch ID',
      transports: ['internal'],
    };
    const regRes = await app.request(
      `${ORIGIN}/account/passkey/register/verify`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(regBody),
      },
      makeEnv(),
    );
    expect(regRes.status).toBe(200);

    // Replay of registration challenge must fail
    const regReplay = await app.request(
      `${ORIGIN}/account/passkey/register/verify`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...regBody, credentialId: b64u(crypto.getRandomValues(new Uint8Array(24))) }),
      },
      makeEnv(),
    );
    expect(regReplay.status).toBe(400);

    // Account page lists registered passkey
    const acctRes = await app.request(`${ORIGIN}/account`, { headers: { cookie } }, makeEnv());
    const acctHtml = await acctRes.text();
    expect(acctHtml).toContain('data-passkeys-panel');
    expect(acctHtml).toContain('MacBook Touch ID');

    // 3. Sign in anonymously via passkey (signCount=1)
    const loginOptRes = await app.request(
      `${ORIGIN}/account/passkey/login/options`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ next: '/account/recipes/new' }),
      },
      makeEnv(),
    );
    expect(loginOptRes.status).toBe(200);
    const loginOpt = (await loginOptRes.json()) as { challengeId: string; options: { challenge: string } };

    const signAssertion = async (challenge: string, rpId: string, signCount: number, privKey: CryptoKey) => {
      const clientData = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }));
      const authData = await buildAuthData(rpId, 0x01, signCount);
      const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData));
      const signed = new Uint8Array(authData.length + clientHash.length);
      signed.set(authData, 0);
      signed.set(clientHash, authData.length);
      const rawSig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, signed));
      return { clientData, authData, derSig: p1363ToDer(rawSig) };
    };

    const goodAssert = await signAssertion(loginOpt.options.challenge, '2yolks.com', 1, kp.privateKey);
    const loginVerRes = await app.request(
      `${ORIGIN}/account/passkey/login/verify`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          challengeId: loginOpt.challengeId,
          credentialId: credId,
          clientDataJSON: b64u(goodAssert.clientData),
          authenticatorData: b64u(goodAssert.authData),
          signature: b64u(goodAssert.derSig),
        }),
      },
      makeEnv(),
    );
    expect(loginVerRes.status).toBe(200);
    const loginJson = (await loginVerRes.json()) as { ok: boolean; email: string; next: string };
    expect(loginJson).toEqual({ ok: true, email: 'passkey@example.com', next: '/account/recipes/new' });
    const passkeyCookie = /(__Host-2y_sid=[0-9a-f]+)/.exec(loginVerRes.headers.get('set-cookie') ?? '')![1]!;

    // Verify new session cookie works
    const authedCheck = await app.request(`${ORIGIN}/account`, { headers: { cookie: passkeyCookie } }, makeEnv());
    expect(authedCheck.status).toBe(200);
    expect(await authedCheck.text()).toContain('passkey@example.com');

    // 4. Reject regressed signCount (1 <= stored 1)
    const replayCountOpt = await (
      await app.request(
        `${ORIGIN}/account/passkey/login/options`,
        { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' }, body: '{}' },
        makeEnv(),
      )
    ).json() as { challengeId: string; options: { challenge: string } };
    const staleAssert = await signAssertion(replayCountOpt.options.challenge, '2yolks.com', 1, kp.privateKey);
    expect(
      (
        await app.request(
          `${ORIGIN}/account/passkey/login/verify`,
          {
            method: 'POST',
            headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              challengeId: replayCountOpt.challengeId,
              credentialId: credId,
              clientDataJSON: b64u(staleAssert.clientData),
              authenticatorData: b64u(staleAssert.authData),
              signature: b64u(staleAssert.derSig),
            }),
          },
          makeEnv(),
        )
      ).status,
    ).toBe(400);

    // 5. Reject wrong rpIdHash and wrong key signature
    const badRpOpt = await (
      await app.request(
        `${ORIGIN}/account/passkey/login/options`,
        { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' }, body: '{}' },
        makeEnv(),
      )
    ).json() as { challengeId: string; options: { challenge: string } };
    const badRpAssert = await signAssertion(badRpOpt.options.challenge, 'evil.example', 2, kp.privateKey);
    expect(
      (
        await app.request(
          `${ORIGIN}/account/passkey/login/verify`,
          {
            method: 'POST',
            headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              challengeId: badRpOpt.challengeId,
              credentialId: credId,
              clientDataJSON: b64u(badRpAssert.clientData),
              authenticatorData: b64u(badRpAssert.authData),
              signature: b64u(badRpAssert.derSig),
            }),
          },
          makeEnv(),
        )
      ).status,
    ).toBe(400);

    const otherKp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const badSigOpt = await (
      await app.request(
        `${ORIGIN}/account/passkey/login/options`,
        { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' }, body: '{}' },
        makeEnv(),
      )
    ).json() as { challengeId: string; options: { challenge: string } };
    const badSigAssert = await signAssertion(badSigOpt.options.challenge, '2yolks.com', 2, otherKp.privateKey);
    expect(
      (
        await app.request(
          `${ORIGIN}/account/passkey/login/verify`,
          {
            method: 'POST',
            headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              challengeId: badSigOpt.challengeId,
              credentialId: credId,
              clientDataJSON: b64u(badSigAssert.clientData),
              authenticatorData: b64u(badSigAssert.authData),
              signature: b64u(badSigAssert.derSig),
            }),
          },
          makeEnv(),
        )
      ).status,
    ).toBe(400);

    // 6. Delete passkey
    const delRes = await app.request(
      `${ORIGIN}/account/passkey/${credId}/delete`,
      { method: 'POST', headers: { origin: ORIGIN, cookie: passkeyCookie } },
      makeEnv(),
    );
    expect(delRes.status).toBe(303);
    const afterDel = await (await app.request(`${ORIGIN}/account`, { headers: { cookie: passkeyCookie } }, makeEnv())).text();
    expect(afterDel).not.toContain('MacBook Touch ID');
  });

  it('S10 Google OAuth is hidden and 503 when unconfigured, and completes PKCE callback when configured', async () => {
    // Unconfigured: omitted on /account, 503 on /google/start
    const offPage = await app.request(`${ORIGIN}/account`, {}, makeEnv());
    const offHtml = await offPage.text();
    expect(offHtml).toContain('data-passkey-login');
    expect(offHtml).not.toContain('data-google-login');
    expect((await app.request(`${ORIGIN}/account/google/start`, {}, makeEnv())).status).toBe(503);

    const gEnv = makeEnv({ GOOGLE_CLIENT_ID: 'gid-test', GOOGLE_CLIENT_SECRET: 'gsec-test' });
    const onHtml = await (await app.request(`${ORIGIN}/account`, {}, gEnv)).text();
    expect(onHtml).toContain('data-google-login');

    const startRes = await app.request(`${ORIGIN}/account/google/start?next=%2Faccount%2Frecipes%2Fnew`, {}, gEnv);
    expect(startRes.status).toBe(302);
    const loc = new URL(startRes.headers.get('location')!);
    expect(loc.origin).toBe('https://accounts.google.com');
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    const state = loc.searchParams.get('state')!;
    const stateCookie = /(2y_gstate=[0-9a-f]+)/.exec(startRes.headers.get('set-cookie') ?? '')![1]!;

    // Mismatched state cookie is rejected
    expect((await app.request(`${ORIGIN}/account/google/callback?code=abc&state=${state}`, { headers: { cookie: '2y_gstate=wrong' } }, gEnv)).status).toBe(400);

    // Mock Google token + userinfo endpoints
    const origFetch = globalThis.fetch;
    const payloadB64 = b64u(
      new TextEncoder().encode(
        JSON.stringify({
          iss: 'https://accounts.google.com',
          aud: 'gid-test',
          sub: 'g-sub-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    const fakeIdToken = `e30.${payloadB64}.sig`;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'ga-token', id_token: fakeIdToken }), { status: 200 });
      }
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return new Response(JSON.stringify({ sub: 'g-sub-123', email: 'google-cook@example.com', email_verified: true, name: 'Elena Google' }), { status: 200 });
      }
      return origFetch(input as never);
    }) as typeof fetch;

    try {
      const cbRes = await app.request(
        `${ORIGIN}/account/google/callback?code=auth-code-1&state=${state}`,
        { headers: { cookie: stateCookie } },
        gEnv,
      );
      expect(cbRes.status).toBe(303);
      expect(cbRes.headers.get('location')).toBe('/account/recipes/new');
      const sidCookie = /(__Host-2y_sid=[0-9a-f]+)/.exec(cbRes.headers.get('set-cookie') ?? '')![1]!;
      const acctHtml = await (await app.request(`${ORIGIN}/account`, { headers: { cookie: sidCookie } }, gEnv)).text();
      expect(acctHtml).toContain('google-cook@example.com');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('D4: discovery cards & featured card hide "Not yet tested", showing "Kitchen-tested" only when tested while keeping recipe page & /recipes honest', async () => {
    await DB.prepare("INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('src-d4', 'Source', 'https://example.com', 'CC-BY-4.0', '2026-01-01T00:00:00Z')").run();
    await DB.prepare("INSERT INTO recipes (id, source_id, origin_country, category, prep_minutes, cook_minutes, total_minutes, tested_at, created_at) VALUES ('d4-untested', 'src-d4', 'us', 'mains', 5, 10, 15, NULL, '2026-01-01T00:00:00Z'), ('d4-tested', 'src-d4', 'us', 'mains', 5, 10, 15, '2026-01-05T00:00:00Z', '2026-01-02T00:00:00Z')").run();
    await DB.prepare("INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('d4-untested', 'us', 'en', 'Untested Skillet Eggs', 'untested-skillet-eggs', 'Simple skillet.', '[\"2 eggs\"]', '[\"Cook eggs.\"]', 'published'), ('d4-tested', 'us', 'en', 'Tested Cornbread', 'tested-cornbread', 'Tested golden loaf.', '[\"200 g cornmeal\"]', '[\"Bake 20 minutes.\"]', 'published')").run();

    // Home & Search: zero "Not yet tested" on cards; tested item gets Kitchen-tested
    const homeHtml = await (await app.request(`${ORIGIN}/`, {}, makeEnv())).text();
    expect(homeHtml).not.toContain('Not yet tested');
    expect(homeHtml).toContain('Kitchen-tested');
    expect(homeHtml).toContain('data-kitchen-tested');

    const searchHtml = await (await app.request(`${ORIGIN}/search?q=eggs`, {}, makeEnv())).text();
    expect(searchHtml).not.toContain('Not yet tested');
    const searchTestedHtml = await (await app.request(`${ORIGIN}/search?q=cornbread`, {}, makeEnv())).text();
    expect(searchTestedHtml).toContain('Kitchen-tested');

    // Localized card label in es
    const homeEs = await (await app.request(`${ORIGIN}/?lang=es`, {}, makeEnv())).text();
    expect(homeEs).not.toContain('A\u00fan no probada');
    expect(homeEs).toContain('Probada en cocina');

    // Recipe detail & /recipes A-Z index still show honest "Not yet tested"
    const detailHtml = await (await app.request(`${ORIGIN}/us/recipes/untested-skillet-eggs`, {}, makeEnv())).text();
    expect(detailHtml).toContain('Not yet tested in a kitchen.');
    const idxHtml = await (await app.request(`${ORIGIN}/recipes`, {}, makeEnv())).text();
    expect(idxHtml).toContain('Not yet tested');
    expect(idxHtml).toContain('Kitchen-tested');
  });
});
