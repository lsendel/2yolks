// Real-UX auth flow: drive the dev auth UI page with a Chrome CDP virtual
// authenticator: create account -> add passkey -> sign out -> passkey sign-in.
// Self-bootstrapping with its own disposable persistence dir.
import { spawn, execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 8812);
const BASE = `http://localhost:${PORT}`;
const PERSIST = '.wrangler-authui';
let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`ok - ${name}`);
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
};

execSync(`rm -rf ${PERSIST}`);
execSync(`npx wrangler d1 execute 2yolks --local --persist-to ${PERSIST} --file packages/api/migrations/0001_init.sql`, { stdio: 'ignore' });
execSync(`npx wrangler d1 execute 2yolks --local --persist-to ${PERSIST} --file packages/api/migrations/0002_auth.sql`, { stdio: 'ignore' });

const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--local', '--persist-to', PERSIST, '--var', 'ALLOW_DEMO_SEED:true'], { stdio: 'ignore', detached: true });
server.on('error', () => {});
const stopServer = () => new Promise((resolve) => {
  if (server.exitCode !== null || server.signalCode !== null) return resolve();
  const done = () => resolve();
  server.once('close', done);
  setTimeout(done, 5000).unref();
  try { process.kill(-server.pid, 'SIGTERM'); }
  catch { try { server.kill('SIGTERM'); } catch {} }
});
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
  await page.setViewport({ width: 390, height: 1200 });
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await page.goto(`${BASE}/api/dev/auth-ui`, { waitUntil: 'networkidle0' });
  const statusAfter = async (action) => {
    const before = await page.$eval('[data-status]', (el) => (el.hidden ? '' : el.textContent));
    await action();
    await page.waitForFunction((prev) => {
      const el = document.querySelector('[data-status]');
      return el && !el.hidden && el.textContent.length > 0 && el.textContent !== prev;
    }, { timeout: 30000 }, before);
    return page.$eval('[data-status]', (el) => el.textContent);
  };

  const email = `ui-${Date.now()}@dev.local`;
  await page.type('[data-name]', 'UI Spike');
  await page.type('[data-email]', email);
  await page.type('[data-password]', 'ui-spike-password-1');
  await page.screenshot({ path: '/downloads/shot-auth-ui.png' });
  const created = await statusAfter(() => page.click('[data-create]'));
  console.log('status:', created);
  check('enroll: account created via real UI', /Account created/.test(created), created);

  const afterEnroll = await page.evaluate(() => ({
    pw: document.querySelector('[data-password]').value,
    retired: document.querySelector('[data-enroll]').classList.contains('retired'),
    createDisabled: document.querySelector('[data-create]').disabled,
  }));
  check('enroll: typed password cleared from DOM', afterEnroll.pw === '', JSON.stringify(afterEnroll));
  check('enroll: signup controls retired with session', afterEnroll.retired && afterEnroll.createDisabled, JSON.stringify(afterEnroll));

  const added = await statusAfter(() => page.click('[data-add-passkey]'));
  console.log('status:', added);
  check('enroll: passkey added via real UI (from account section)', /Passkey added/.test(added), added);

  await page.click('[data-signout]');
  await page.waitForFunction(() => document.querySelector('[data-session-box]').hidden, { timeout: 10000 });
  check('sign out hides session', true);
  const restored = await page.evaluate(() => ({
    retired: document.querySelector('[data-enroll]').classList.contains('retired'),
    createDisabled: document.querySelector('[data-create]').disabled,
  }));
  check('sign out restores signup controls', !restored.retired && !restored.createDisabled, JSON.stringify(restored));

  const signedIn = await statusAfter(() => page.click('[data-passkey-signin]'));
  console.log('status:', signedIn);
  check('sign-in with passkey via real UI', /Signed in/.test(signedIn), signedIn);
  const who = await page.$eval('[data-session-email]', (el) => el.textContent);
  check('session shows the enrolled account', who === email, who);
  await page.screenshot({ path: '/downloads/shot-auth-ui-signedin.png' });
} finally {
  await browser.close();
  await stopServer();
}
process.exit(failures === 0 ? 0 : 1);
