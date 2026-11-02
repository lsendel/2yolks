// Route-level smoke tests against a real wrangler dev (workerd) runtime.
// Usage: node scripts/smoke.mjs
import { spawn, execSync } from 'node:child_process';

const PORT = Number(process.env.PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;

process.on('unhandledRejection', (err) => {
  failures++;
  console.error('FAIL - unhandled rejection:', err && err.message ? err.message : err);
});

async function waitForHealth(port, timeoutMs = 90000) {
  const url = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`FAIL - dev server did not become healthy on ${url} within ${timeoutMs / 1000}s`);
  process.exit(1);
}

function check(name, cond, extra = '') {
  if (cond) { console.log(`ok - ${name}`); }
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
}

// Spawn detached so the whole process tree (npx shim + wrangler + workerd)
// can be killed as a group; un-killed grandchildren leak ports and turn a
// green run into a nonzero exit under CI process reaping.
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

async function get(path, init) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init });
  return { status: res.status, headers: res.headers, body: await res.text(), location: res.headers.get('location') };
}

// fresh local D1: migration + demo seeds
execSync('rm -rf .wrangler');
execSync('npx wrangler d1 execute 2yolks --local --file packages/api/migrations/0001_init.sql', { stdio: 'ignore' });
execSync('npx wrangler d1 execute 2yolks --local --file packages/api/seeds/0001_demo.sql', { stdio: 'ignore' });
execSync('npx wrangler d1 execute 2yolks --local --file packages/api/seeds/0002_demo_malicious.sql', { stdio: 'ignore' });

const server = spawnServer(['wrangler', 'dev', '--port', String(PORT), '--local']);
// production mode: ALLOW_DEMO_SEED defaults to false
// Poll /api/health, not a fixed sleep: first `wrangler dev` on a cold CI
// runner downloads workerd and can take far longer than 12s.
await waitForHealth(PORT);

try {
  let r = await get('/');
  check('home 200 with market links', r.status === 200 && r.body.includes('/us/') && r.body.includes('/mx/'));

  r = await get('/us/');
  check('empty wave-1 country home is 200 + noindex header', r.status === 200 && r.headers.get('x-robots-tag') === 'noindex');

  r = await get('/gb/');
  check('wave-0 country home is 404', r.status === 404);

  r = await get('/zz/');
  check('unknown country is 404', r.status === 404);

  r = await get('/mx/recipes/r1-huevos-rancheros');
  check('demo recipe hidden in production mode (404)', r.status === 404);

  r = await get('/api/v1/countries/mx/recipes');
  check('api list 200, demo rows excluded', r.status === 200 && JSON.parse(r.body).recipes.length === 0);

  r = await get('/api/v1/countries/zz/recipes');
  check('api unknown country JSON 404', r.status === 404 && JSON.parse(r.body).error);

  r = await get('/api/nope');
  check('unknown api route JSON 404', r.status === 404 && JSON.parse(r.body).error === 'not found');

  r = await get('/robots.txt');
  check('robots.txt 200 with sitemap + api disallow', r.status === 200 && r.body.includes('Sitemap: https://2yolks.com/sitemap.xml') && r.body.includes('Disallow: /api/'));

  r = await get('/sitemap.xml');
  check('sitemap 200, demo rows excluded in production', r.status === 200 && r.body.includes('<urlset') && !r.body.includes('huevos-rancheros'));

  r = await get('/api/v1/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('submissions closed by default (503)', r.status === 503);

  // dev mode: demo seed visible
  await stopServer(server);
  const PORT2 = PORT + 1;
  const dev = spawnServer(['wrangler', 'dev', '--port', String(PORT2), '--local', '--var', 'ALLOW_DEMO_SEED:true', '--var', 'SUBMISSIONS_ENABLED:true']);
  await waitForHealth(PORT2);
  try {
    const get2 = async (path) => { const res = await fetch(`http://127.0.0.1:${PORT2}` + path, { redirect: 'manual' }); return { status: res.status, headers: res.headers, body: await res.text(), location: res.headers.get('location') }; };
    r = await get2('/mx/recipes/r1-huevos-rancheros');
    check('dev mode: recipe 200 with es chrome', r.status === 200 && r.body.includes('<h2>Ingredientes</h2>') && r.body.includes('Clásico'));
    check('dev mode: demo recipe page noindex meta', r.body.includes('noindex, nofollow'));
    check('hreflang exact equivalents + x-default', r.body.includes('hreflang="es-MX"') && r.body.includes('hreflang="en-US"') && r.body.includes('hreflang="x-default"'));
    check('hreflang uses pinned canonical origin', r.body.includes('https://2yolks.com/us/recipes/r1-ranch-eggs'));
    check('interactive: scaler rendered with qty data', r.body.includes('class="scaler"') && r.body.includes('data-qty=') && r.body.includes('data-mult="0.5"'));
    check('interactive: ingredient checkboxes', r.body.includes('<input type="checkbox"'));
    check('interactive: cook mode overlay + data + client script', r.body.includes('data-cook-mode') && r.body.includes('id="cook-data"') && r.body.includes('wakeLock'));
    check('interactive: es cook-mode chrome', r.body.includes('Modo cocina') && r.body.includes('Ir a la receta'));

    r = await get2('/mx/recipes/r1-stale-slug');
    check('stale slug 301 to canonical', r.status === 301 && r.location === '/mx/recipes/r1-huevos-rancheros');

    r = await get2('/us/recipes/r2-evil-recipe');
    check('XSS: title escaped', r.status === 200 && !r.body.includes('</title><script>alert(1)</script>'));
    check('XSS: no live script breakout anywhere', !r.body.includes('<script>alert') && !r.body.includes('</title><script>'));

    r = await get2('/sitemap.xml');
    check('sitemap dev: r1 both locales + hreflang links', r.body.includes('/mx/recipes/r1-huevos-rancheros') && r.body.includes('/us/recipes/r1-ranch-eggs') && r.body.includes('hreflang="es-MX"') && r.body.includes('hreflang="en-US"'));

    // submission draft path (enabled in this dev server)
    const post = async (body) => { const res = await fetch(`http://127.0.0.1:${PORT2}/api/v1/submissions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: res.status, json: await res.json() }; };
    let pr = await post({ nope: true });
    check('submission: malformed body rejected 400', pr.status === 400 && pr.json.error === 'validation failed');
    pr = await post({ source: { name: 'Test cook', url: 'https://cook.example/r1', license: 'unknown' }, locales: [{ country: 'mx', lang: 'es', title: 'Salsa de Prueba', ingredients: ['1 tomate'], steps: ['Picar el tomate'] }] });
    check('submission: valid draft created 201', pr.status === 201 && pr.json.status === 'draft' && /^[a-z0-9]{8}$/.test(pr.json.id), JSON.stringify(pr.json));
    const draftId = pr.json.id;
    r = await get2(`/mx/recipes/${draftId}-salsa-de-prueba`);
    check('submission: draft never served (404, cleared_at gate)', r.status === 404);
    pr = await post({ source: { name: 'x', url: 'http://insecure.example', license: 'unknown' }, locales: [{ country: 'mx', lang: 'es', title: 't', ingredients: ['a'], steps: ['b'] }] });
    check('submission: insecure source url rejected', pr.status === 400);
  } finally {
    await stopServer(dev);
  }
} finally {
  await stopServer(server);
}
process.exit(failures === 0 ? 0 : 1);
