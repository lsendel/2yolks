import { it } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Render fixtures land in FIXTURE_OUT when set (pixel pipeline), else a fresh
// temp dir so the suite is green on any machine.
const OUT = process.env['FIXTURE_OUT'] ?? mkdtempSync(join(tmpdir(), '2yolks-fixtures-'));
mkdirSync(OUT, { recursive: true });
import app from './index';
import { migratedD1All } from './testd1';

it('writes capture form fixture HTML', async () => {
  const DB = migratedD1All();
  const env = { DB, CANONICAL_ORIGIN: 'https://2yolks.com', ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'true', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test', REVIEW_NOTIFY_TO: 'owner@example.com' };
  const realFetch = globalThis.fetch;
  let code = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const body = JSON.parse(String(init!.body));
      code = /code is (\d{6})/.exec(body.text)![1]!;
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
  const post = (path: string, form: Record<string, string>, cookie?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://2yolks.com' };
    if (cookie) headers['cookie'] = cookie;
    return app.request(`https://2yolks.com${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env);
  };
  await post('/account/code', { email: 'cook@example.com' });
  const res = await post('/account/verify', { email: 'cook@example.com', code });
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  const page = await app.request('https://2yolks.com/account/recipes/new', { headers: { cookie } }, env);
  writeFileSync(`${OUT}/capture-form.html`, await page.text());
  // pre-filled state: save a draft, then capture the edit page
  await post('/account/recipes/save', {
    title: 'Sopa de la abuela', locale: 'us:es', category: 'soups-stews', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1',
  }, cookie);
  const row = await DB.prepare('SELECT id FROM recipes').first<{ id: string }>();
  const edit = await app.request(`https://2yolks.com/account/recipes/${row!.id}/edit`, { headers: { cookie } }, env);
  writeFileSync(`${OUT}/capture-edit.html`, await edit.text());
});

it('writes localized account fixture HTML', async () => {
  const DB = migratedD1All();
  const env = { DB, CANONICAL_ORIGIN: 'https://2yolks.com', ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'true', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test', REVIEW_NOTIFY_TO: 'owner@example.com' };
  const realFetch = globalThis.fetch;
  let code = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const body = JSON.parse(String(init!.body));
      code = /\b(\d{6})\b/.exec(body.text)![1]!;
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
  const post = (path: string, form: Record<string, string>, cookie?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://2yolks.com' };
    if (cookie) headers['cookie'] = cookie;
    return app.request(`https://2yolks.com${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env);
  };
  const get = (path: string, cookie?: string) => app.request(`https://2yolks.com${path}`, cookie ? { headers: { cookie } } : {}, env);

  writeFileSync(`${OUT}/account-signin-es.html`, await (await get('/account?lang=es')).text());
  writeFileSync(`${OUT}/account-signin-fr.html`, await (await get('/account?lang=fr')).text());
  const codePage = await post('/account/code?lang=es', { email: 'cook@example.com' });
  writeFileSync(`${OUT}/account-code-es.html`, await codePage.text());
  const res = await post('/account/verify?lang=es', { email: 'cook@example.com', code });
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  await post('/account/recipes/save?lang=es', {
    title: 'Sopa de la abuela', locale: 'us:es', category: 'soups-stews', intro: 'Caliente.', ingredients: '2 tazas de caldo\n1 cebolla', steps: 'Picar.\nCocer a fuego lento.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1',
  }, cookie);
  writeFileSync(`${OUT}/account-home-es.html`, await (await get('/account?lang=es', cookie)).text());
  writeFileSync(`${OUT}/account-home-fr.html`, await (await get('/account?lang=fr', cookie)).text());
  writeFileSync(`${OUT}/account-form-es.html`, await (await get('/account/recipes/new?lang=es', cookie)).text());
  writeFileSync(`${OUT}/account-form-fr.html`, await (await get('/account/recipes/new?lang=fr', cookie)).text());
  await post('/account/recipes/save?lang=fr', {
    title: 'Soupe de grand-mère', locale: 'us:fr', category: 'soups-stews', intro: 'Chaude.', ingredients: '2 tasses de bouillon\n1 oignon', steps: 'Hacher.\nMijoter.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1',
  }, cookie);
  const ids = (await DB.prepare('SELECT id FROM recipes ORDER BY created_at, id').all()).results as { id: string }[];
  const submitted = await post(`/account/recipes/${ids[0]!.id}/submit?lang=es`, {}, cookie);
  writeFileSync(`${OUT}/account-submitted-es.html`, await submitted.text());
  writeFileSync(`${OUT}/account-submitted-fr.html`, await (await post(`/account/recipes/${ids[1]!.id}/submit?lang=fr`, {}, cookie)).text());
  writeFileSync(`${OUT}/account-home-submitted-es.html`, await (await get('/account?lang=es', cookie)).text());
});

it('writes C2 permission fixture HTML', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const { makeD1 } = await import('./testd1');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.exec(readFileSync(new URL('../../../design/0007-consent-revisions.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../../design/0008-consent-scope.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../../design/0009-image-provenance.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../../design/0010-content-fence.sql', import.meta.url), 'utf8'));
  const DB = makeD1(sqlite);
  const env = { DB, CANONICAL_ORIGIN: 'https://2yolks.com', ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'false', CONSENT_FLOW_ENABLED: 'true', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test' };
  const realFetch = globalThis.fetch;
  let code = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const body = JSON.parse(String(init!.body));
      code = /\b(\d{6})\b/.exec(body.text)![1]!;
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
  const post = (path: string, form: Record<string, string>, cookie?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://2yolks.com' };
    if (cookie) headers['cookie'] = cookie;
    return app.request(`https://2yolks.com${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env);
  };
  const get = (path: string, cookie: string) => app.request(`https://2yolks.com${path}`, { headers: { cookie } }, env);
  await post('/account/code', { email: 'cook@example.com' });
  const cookie = (await post('/account/verify', { email: 'cook@example.com', code })).headers.get('set-cookie')!.split(';')[0]!;
  await post('/account/recipes/save', {
    title: 'Sopa de la abuela', locale: 'us:es', category: 'soups-stews', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1',
  }, cookie);
  const row = await DB.prepare('SELECT id FROM recipes').first<{ id: string }>();
  const id = row!.id;
  await DB.prepare(`INSERT INTO recipe_images (id, recipe_id, kind, step_index, r2_key, mime, bytes, style, source_name, source_url, license)
    VALUES ('img-1', ?, 'hero', NULL, 'r2/img-1', 'image/jpeg', 12345, 'photo', 'Ana', 'https://2yolks.com/', 'proprietary')`).bind(id).run();
  writeFileSync(`${OUT}/permission-en.html`, await (await get(`/account/recipes/${id}/permission`, cookie)).text());
  writeFileSync(`${OUT}/permission-es.html`, await (await get(`/account/recipes/${id}/permission?lang=es`, cookie)).text());
  // granted state (text only)
  const fixtureHtml = readFileSync(`${OUT}/permission-en.html`, 'utf8');
  const shownHashM = /name="shown_hash" value="([0-9a-f]{64})"/.exec(fixtureHtml);
  const shownSeqM = /name="shown_seq" value="(\d+)"/.exec(fixtureHtml);
  if (!shownHashM || !shownSeqM) throw new Error('displayed-state binding missing from the fixture page');
  await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: shownHashM[1]!, shown_seq: shownSeqM[1]! }, cookie);
  writeFileSync(`${OUT}/permission-es-granted.html`, await (await get(`/account/recipes/${id}/permission?lang=es`, cookie)).text());
});
