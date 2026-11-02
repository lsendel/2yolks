// End-to-end passkey ceremony against local wrangler dev (workerd) using a
// Chrome CDP virtual authenticator: real navigator.credentials.create()/get()
// ceremonies, no fixtures. Wall times are UX evidence only - Workers CPU
// billing cannot be measured locally; WebCrypto is off-clock per CF docs.
// Usage: wrangler dev --port 8810 --local --var ALLOW_DEMO_SEED:true (running)
//        node scripts/auth-ceremony.check.mjs
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 8810);
const BASE = `http://localhost:${PORT}`;
let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`ok - ${name}`);
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  console.log('virtual authenticator:', authenticatorId);

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
} finally {
  await browser.close();
}
process.exit(failures === 0 ? 0 : 1);
