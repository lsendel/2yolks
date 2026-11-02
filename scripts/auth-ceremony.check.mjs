// End-to-end passkey ceremony + adversarial regression probes against local
// wrangler dev (workerd) using a Chrome CDP virtual authenticator: real
// navigator.credentials.create()/get() ceremonies, no fixtures.
//
// Self-bootstrapping: resets local D1 state, applies migrations 0001+0002,
// spawns its own dev server, and kills the whole process group on exit.
//
// Wall times are UX evidence only - Workers CPU billing cannot be measured
// locally; WebCrypto is off-clock per CF docs.
// Usage: node scripts/auth-ceremony.check.mjs
import { spawn, execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 8810);
const BASE = `http://localhost:${PORT}`;
let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`ok - ${name}`);
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
};

// --- clean local state: dedicated disposable persistence dir, so the reset
// can never erase shared .wrangler developer state or race other suites ----
const PERSIST = '.wrangler-ceremony';
execSync(`rm -rf ${PERSIST}`);
execSync(`npx wrangler d1 execute 2yolks --local --persist-to ${PERSIST} --file packages/api/migrations/0001_init.sql`, { stdio: 'ignore' });
execSync(`npx wrangler d1 execute 2yolks --local --persist-to ${PERSIST} --file packages/api/migrations/0002_auth.sql`, { stdio: 'ignore' });

function spawnServer(args) {
  const child = spawn('npx', args, { stdio: 'ignore', detached: true });
  child.on('error', () => {});
  return child;
}
function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const done = () => resolve();
    child.once('close', done);
    setTimeout(done, 5000).unref();
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch { try { child.kill('SIGTERM'); } catch {} }
  });
}

const server = spawnServer(['wrangler', 'dev', '--port', String(PORT), '--local', '--persist-to', PERSIST, '--var', 'ALLOW_DEMO_SEED:true']);
// readiness poll instead of a fixed sleep
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto(`${BASE}/api/dev/auth-test`, { waitUntil: 'networkidle0' });

  const clickAndWaitLog = async (id, timeout = 30000) => {
    const before = await page.$eval('#log', (el) => el.textContent);
    await page.click(`#${id}`);
    await page.waitForFunction(
      (prev) => document.querySelector('#log').textContent.length > prev.length,
      { timeout }, before,
    );
    return page.$eval('#log', (el, prev) => el.textContent.slice(prev.length).trim(), before);
  };

  const signup = await clickAndWaitLog('signup');
  console.log('log:', signup);
  check('signup 200 (adapter writes user+session to D1)', signup.startsWith('signup 200'), signup);

  const register = await clickAndWaitLog('register');
  console.log('log:', register);
  check('passkey registration ceremony 200', register.startsWith('register 200'), register);

  const auth = await clickAndWaitLog('authenticate');
  console.log('log:', auth);
  check('passkey authentication ceremony 200', auth.startsWith('authenticate 200'), auth);

  const regMs = Number(/verifyWall=(\d+)ms/.exec(register)?.[1]);
  const authMs = Number(/verifyWall=(\d+)ms/.exec(auth)?.[1]);
  console.log(`verify wall times: registration=${regMs}ms authentication=${authMs}ms (client-side wall; not Workers CPU billing)`);
  check('registration verify wall < 500ms', Number.isFinite(regMs) && regMs < 500, String(regMs));
  check('authentication verify wall < 500ms', Number.isFinite(authMs) && authMs < 500, String(authMs));

  // --- adversarial regression probes (run in the page realm) --------------

  // 1. replay: re-post the exact consumed assertion
  const replay = await page.evaluate(async () => {
    const r = await fetch('/api/dev/auth/passkey/verify-authentication', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: window.__lastAuthBody,
    });
    let j = {}; try { j = await r.json(); } catch {}
    return { status: r.status, code: j.code || '' };
  });
  console.log('probe replay:', JSON.stringify(replay));
  check('replay of consumed assertion rejected 400 CHALLENGE_NOT_FOUND',
    replay.status === 400 && replay.code === 'CHALLENGE_NOT_FOUND', JSON.stringify(replay));

  // 2+3. FORGED challenge (sign a challenge the server never issued):
  // rejected, and the failed verify CONSUMES the live challenge so a
  // subsequently valid assertion against it is 400.
  const tamper = await page.evaluate(async () => {
    const getOpts = await (await fetch('/api/dev/auth/passkey/generate-authenticate-options')).json();
    const toBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer;
    const ser = (cred) => ({
      id: cred.id, rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      type: cred.type,
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        signature: btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        userHandle: cred.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(cred.response.userHandle))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : undefined,
      },
    });
    const postV = (body) => fetch('/api/dev/auth/passkey/verify-authentication', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, code: (await r.json().catch(() => ({}))).code || '' }));

    // valid assertion over the live challenge (held back, not posted yet)
    const goodOpts = { ...getOpts, challenge: toBuf(getOpts.challenge),
      allowCredentials: (getOpts.allowCredentials || []).map((d) => ({ ...d, id: toBuf(d.id) })) };
    const goodCred = await navigator.credentials.get({ publicKey: goodOpts });
    const goodBody = { response: ser(goodCred) };

    // tampered: same options but a different challenge gets signed
    const tamperedOpts = { ...goodOpts, challenge: crypto.getRandomValues(new Uint8Array(32)).buffer };
    const badCred = await navigator.credentials.get({ publicKey: tamperedOpts });
    const bad = await postV({ response: ser(badCred) });
    const afterFail = await postV(goodBody);
    return { bad, afterFail };
  });
  console.log('probe tamper:', JSON.stringify(tamper));
  // Reviewer observed 401 AUTHENTICATION_FAILED; local reproduction returns
  // 400 with the same code - assert the semantic rejection, note both.
  check('forged challenge rejected (400/401) AUTHENTICATION_FAILED',
    (tamper.bad.status === 400 || tamper.bad.status === 401) && tamper.bad.code === 'AUTHENTICATION_FAILED',
    JSON.stringify(tamper.bad));
  check('failed verification consumes the live challenge (valid replay 400)',
    tamper.afterFail.status === 400, JSON.stringify(tamper.afterFail));

  // 3b. CORRUPTED SIGNATURE: a valid assertion over the LIVE challenge with
  // flipped signature bytes - manual reviewer proved 401 here.
  const corrupt = await page.evaluate(async () => {
    const getOpts = await (await fetch('/api/dev/auth/passkey/generate-authenticate-options')).json();
    const toBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const opts = { ...getOpts, challenge: toBuf(getOpts.challenge).buffer,
      allowCredentials: (getOpts.allowCredentials || []).map((d) => ({ ...d, id: toBuf(d.id).buffer })) };
    const cred = await navigator.credentials.get({ publicKey: opts });
    const sig = new Uint8Array(cred.response.signature.slice(0));
    sig[10] ^= 0xff; // corrupt the actual ECDSA signature bytes
    const body = { response: {
      id: cred.id, rawId: b64(new Uint8Array(cred.rawId)), type: cred.type,
      response: {
        clientDataJSON: b64(new Uint8Array(cred.response.clientDataJSON)),
        authenticatorData: b64(new Uint8Array(cred.response.authenticatorData)),
        signature: b64(sig),
        userHandle: cred.response.userHandle ? b64(new Uint8Array(cred.response.userHandle)) : undefined,
      },
    } };
    const r = await fetch('/api/dev/auth/passkey/verify-authentication', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    let j = {}; try { j = await r.json(); } catch {}
    return { status: r.status, code: j.code || '' };
  });
  console.log('probe corrupt-signature:', JSON.stringify(corrupt));
  check('corrupted signature over live challenge rejected 401 AUTHENTICATION_FAILED',
    corrupt.status === 401 && corrupt.code === 'AUTHENTICATION_FAILED', JSON.stringify(corrupt));

  // 4. verify without any options cookie
  const noCookie = await page.evaluate(async () => {
    const r = await fetch('/api/dev/auth/passkey/verify-authentication', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      credentials: 'omit', body: JSON.stringify({ response: {} }),
    });
    return r.status;
  });
  console.log('probe no-cookie:', noCookie);
  check('verify without options cookie rejected (400/401)', noCookie === 400 || noCookie === 401, String(noCookie));

  // 5. cookieless session lookup returns null
  const noSession = await page.evaluate(async () => {
    const r = await fetch('/api/dev/auth/get-session', { credentials: 'omit' });
    return { status: r.status, body: await r.text() };
  });
  console.log('probe get-session cookieless:', JSON.stringify(noSession));
  check('cookieless get-session yields no session', noSession.status === 200 && /null/.test(noSession.body), JSON.stringify(noSession));

  // 6. weak password rejected
  const weak = await page.evaluate(async () => {
    const r = await fetch('/api/dev/auth/sign-up/email', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `weak-${Date.now()}@dev.local`, password: 'short', name: 'W' }),
    });
    return r.status;
  });
  console.log('probe weak password:', weak);
  check('weak password rejected 400', weak === 400, String(weak));
} finally {
  await browser.close();
  await stopServer(server);
}
process.exit(failures === 0 ? 0 : 1);
