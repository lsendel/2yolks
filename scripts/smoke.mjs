// Route-level smoke tests against a real wrangler dev (workerd) runtime.
// Usage: node scripts/smoke.mjs
import { spawn, execSync } from 'node:child_process';

const PORT = Number(process.env.PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;

function check(name, cond, extra = '') {
  if (cond) { console.log(`ok - ${name}`); }
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
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

const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--local'], { stdio: 'ignore' });
// production mode: ALLOW_DEMO_SEED defaults to false
await new Promise((r) => setTimeout(r, 12000));

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

  // dev mode: demo seed visible
  server.kill('SIGTERM');
  await new Promise((r2) => setTimeout(r2, 3000));
  const PORT2 = PORT + 1;
  const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT2), '--local', '--var', 'ALLOW_DEMO_SEED:true'], { stdio: 'ignore' });
  await new Promise((r2) => setTimeout(r2, 12000));
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
  } finally {
    dev.kill('SIGTERM');
  }
} finally {
  server.kill('SIGTERM');
}
process.exit(failures === 0 ? 0 : 1);
