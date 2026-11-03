// Interaction tests against a live wrangler dev server: real Chrome via CDP.
// Verifies serving-scaler math, cook-mode overlay/step navigation, and timer.
// Usage: node scripts/interaction.test.mjs   (expects wrangler dev on PORT)
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 8804);
const BASE = `http://127.0.0.1:${PORT}`;
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
  await page.setViewport({ width: 390, height: 1200 });
  await page.goto(`${BASE}/mx/recipes/r1-huevos-rancheros`, { waitUntil: 'networkidle0' });

  // no horizontal overflow on mobile
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check('mobile: no horizontal scroll', !overflow);

  // serving scaler math (demo r1: "2 huevos", "2 tortillas", "salsa")
  const q0 = await page.$eval('.qty[data-qty]', (el) => el.textContent);
  check('scaler: initial qty is 2', q0 === '2', q0);
  await page.click('button[data-mult="2"]');
  const q2 = await page.$eval('.qty[data-qty]', (el) => el.textContent);
  check('scaler: 2x doubles to 4', q2 === '4', q2);
  await page.click('button[data-mult="0.5"]');
  const qHalf = await page.$eval('.qty[data-qty]', (el) => el.textContent);
  check('scaler: 0.5x halves to 1', qHalf === '1', qHalf);
  await page.click('button[data-mult="1"]');

  // ingredient checkbox toggles line-through (computed style)
  await page.click('.ingredients li:first-child input[type="checkbox"]');
  const struck = await page.$eval('.ingredients li:first-child .qty', (el) => getComputedStyle(el).textDecorationLine);
  check('checkbox: line-through applied', struck.includes('line-through'), struck);

  // cook mode: open, step text, navigation, wake lock attempt does not throw
  await page.click('[data-cook-open]');
  const overlayVisible = await page.$eval('[data-cook-mode]', (el) => !el.hidden);
  check('cook mode: overlay opens', overlayVisible);
  const step1 = await page.$eval('[data-cook-step]', (el) => el.textContent);
  check('cook mode: shows step 1', step1 === 'Calentar las tortillas', step1);
  const prog1 = await page.$eval('[data-cook-progress]', (el) => el.textContent);
  check('cook mode: progress 1 / 3', prog1 === '1 / 3', prog1);
  await page.click('[data-cook-next]');
  const step2 = await page.$eval('[data-cook-step]', (el) => el.textContent);
  check('cook mode: next shows step 2', step2 === 'Freír los huevos', step2);
  await page.click('[data-cook-prev]');

  // timer: mx steps have no time mention -> hidden; en step 2 has "3 minutes"
  const timerHidden = await page.$eval('[data-cook-timer]', (el) => el.hidden);
  check('cook mode: timer hidden without time mention', timerHidden);
  // Pixel-level regression: the hidden attribute must win over display:flex
  // (computed style), or MX untimed steps show a blank timer button.
  const cookTimerState = await page.$eval('[data-cook-timer]', (el) => getComputedStyle(el).display);
  check('cook mode: untimed step hides timer visually', cookTimerState === 'none', cookTimerState);
  await page.click('[data-cook-close]');
  const overlayClosed = await page.$eval('[data-cook-mode]', (el) => el.hidden);
  check('cook mode: closes', overlayClosed);

  await page.goto(`${BASE}/us/recipes/r1-ranch-eggs`, { waitUntil: 'networkidle0' });
  await page.click('[data-cook-open]');
  await page.click('[data-cook-next]');
  const timerShown = await page.$eval('[data-cook-timer]', (el) => !el.hidden);
  check('cook mode: timer shown for "Fry eggs 3 minutes"', timerShown);
  const label = await page.$eval('[data-timer-label]', (el) => el.textContent);
  check('timer: label 3 min', label === '3 min', label);
  await page.click('[data-timer-btn]');
  const display = await page.$eval('[data-timer-display]', (el) => el.textContent);
  check('timer: countdown starts', /^3:0|^2:5/.test(display || ''), display);

  await page.screenshot({ path: '/downloads/shot-recipe-mobile.png' });
  await page.click('[data-cook-open]');
  await page.screenshot({ path: '/downloads/shot-cookmode.png' });
} finally {
  await browser.close();
}
process.exit(failures === 0 ? 0 : 1);
