import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';
import { migratedD1All } from './testd1';

type Sent = { to: string[]; subject: string; text: string };
let DB: D1Database;
let sent: Sent[];
const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;

function env(extra: Record<string, unknown> = {}) {
  return { DB, CANONICAL_ORIGIN: ORIGIN, ALLOW_DEMO_SEED: 'false', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test', REVIEW_NOTIFY_TO: 'owner@example.com', ...extra };
}
function post(path: string, form: Record<string, string>, opts: { cookie?: string; origin?: string | null; e?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (opts.origin !== null) headers['origin'] = opts.origin ?? ORIGIN;
  if (opts.cookie) headers['cookie'] = opts.cookie;
  return app.request(`${ORIGIN}${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env(opts.e));
}
function get(path: string, cookie?: string) {
  return app.request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} }, env());
}
const lastCode = () => /code is (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;

async function signIn(email = 'cook@example.com'): Promise<string> {
  await post('/account/code', { email });
  const res = await post('/account/verify', { email, code: lastCode() });
  expect(res.status).toBe(303);
  const sc = res.headers.get('set-cookie')!;
  expect(sc).toMatch(/__Host-2y_sid=[0-9a-f]{64}/);
  expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/Secure/i); expect(sc).toMatch(/SameSite=Lax/i);
  return sc.split(';')[0]!;
}
const recipeForm = (over: Record<string, string> = {}) => ({
  title: 'Abuela Soup', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
  prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', ...over,
});

beforeEach(() => {
  DB = migratedD1All();
  sent = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      expect((init?.headers as Record<string, string>)['authorization']).toBe('Bearer re_test');
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

describe('email-code auth', () => {
  it('signs in with the emailed code, stores only hashes, and signs out', async () => {
    const cookie = await signIn();
    expect(sent[0]!.to).toEqual(['cook@example.com']);
    const h = await DB.prepare('SELECT code_hash FROM auth_codes').first<{ code_hash: string }>();
    expect(h!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    const sess = await DB.prepare('SELECT id FROM sessions').first<{ id: string }>();
    expect(sess!.id).not.toBe(cookie.split('=')[1]);
    const page = await get('/account', cookie);
    expect(await page.text()).toContain('Signed in as cook@example.com');
    expect(page.headers.get('cache-control')).toBe('no-store');
    await post('/account/logout', {}, { cookie });
    expect(await (await get('/account', cookie)).text()).toContain('Email me a code');
  });
  it('rejects wrong codes, caps attempts and burns used codes', async () => {
    await post('/account/code', { email: 'a@example.com' });
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await post('/account/verify', { email: 'a@example.com', code: wrong })).status).toBe(400);
    expect((await post('/account/verify', { email: 'a@example.com', code: good })).status).toBe(400);
    await post('/account/code', { email: 'b@example.com' });
    const c2 = lastCode();
    expect((await post('/account/verify', { email: 'b@example.com', code: c2 })).status).toBe(303);
    expect((await post('/account/verify', { email: 'b@example.com', code: c2 })).status).toBe(400);
  });
  it('rejects expired codes, a code for another email, and malformed email', async () => {
    await post('/account/code', { email: 'a@example.com' });
    const code = lastCode();
    expect((await post('/account/verify', { email: 'other@example.com', code })).status).toBe(400);
    await DB.prepare('UPDATE auth_codes SET expires_at = 1').run();
    expect((await post('/account/verify', { email: 'a@example.com', code })).status).toBe(400);
    expect((await post('/account/code', { email: 'nope' })).status).toBe(400);
  });
  it('throttles per email and per day, and answers 503 when mail is not configured', async () => {
    for (let i = 0; i < 3; i++) expect((await post('/account/code', { email: 'a@example.com' })).status).toBe(200);
    expect((await post('/account/code', { email: 'a@example.com' })).status).toBe(429);
    expect((await post('/account/code', { email: 'z@example.com' }, { e: { RESEND_API_KEY: undefined } })).status).toBe(503);
    const rl = { limit: async () => ({ success: false }) };
    expect((await post('/account/code', { email: 'q@example.com' }, { e: { RL_AUTH: rl } })).status).toBe(429);
  });
  it('removes the code row when the email send fails', async () => {
    globalThis.fetch = (async () => new Response('no', { status: 500 })) as typeof fetch;
    expect((await post('/account/code', { email: 'a@example.com' })).status).toBe(503);
    expect((await DB.prepare('SELECT count(*) AS n FROM auth_codes').first<{ n: number }>())!.n).toBe(0);
  });
  it('blocks cross-origin and origin-less POSTs (CSRF)', async () => {
    expect((await post('/account/code', { email: 'a@example.com' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/account/code', { email: 'a@example.com' }, { origin: null })).status).toBe(403);
    const cookie = await signIn();
    expect((await post('/account/recipes/save', recipeForm(), { cookie, origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/account/logout', {}, { cookie, origin: 'https://evil.example' })).status).toBe(403);
  });
  it('requires a session for recipe routes', async () => {
    expect((await get('/account/recipes/new')).status).toBe(303);
    expect((await post('/account/recipes/save', recipeForm())).status).toBe(303);
    expect((await post('/account/recipes/import', { url: 'https://example.com' })).status).toBe(303);
  });
});

describe('private drafts', () => {
  it('saves a private draft that is never public, then edits it', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm(), { cookie });
    expect(res.status).toBe(303);
    const loc = res.headers.get('location')!;
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(loc)![1]!;
    const row = await DB.prepare('SELECT r.owner_user_id AS o, r.attested_at AS a, r.submitted_at AS s, l.status AS st, l.slug AS slug, s.cleared_at AS c, s.license AS lic FROM recipes r JOIN recipe_locales l ON l.recipe_id=r.id JOIN sources s ON s.id=r.source_id WHERE r.id=?').bind(id).first<Record<string, unknown>>();
    expect(row!['o']).toBeTruthy(); expect(row!['a']).toBeTruthy(); expect(row!['s']).toBeNull(); expect(row!['st']).toBe('draft'); expect(row!['c']).toBeNull(); expect(row!['lic']).toBe('user-original');
    expect((await get(`/us/recipes/${row!['slug']}`)).status).toBe(404);
    expect(((await (await get('/api/v1/countries/us/recipes')).json()) as { recipes?: unknown[] }).recipes ?? []).toHaveLength(0);
    const edit = await get(loc, cookie);
    expect(await edit.text()).toContain('Abuela Soup');
    const upd = await post('/account/recipes/save', { ...recipeForm({ title: 'Abuela Soup v2' }), id }, { cookie });
    expect(upd.status).toBe(303);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipe_locales').first<{ n: number }>())!.n).toBe(1);
    expect((await DB.prepare('SELECT title FROM recipe_locales').first<{ title: string }>())!.title).toBe('Abuela Soup v2');
  });
  it('validates input with readable errors and keeps what was typed', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm({ title: 'X', ingredients: '', source_kind: 'adapted', source_url: 'http://nope' }), { cookie });
    expect(res.status).toBe(400);
    const t = await res.text();
    expect(t).toContain('https://'); expect(t).toContain('ingredients');
    expect((await DB.prepare('SELECT count(*) AS n FROM recipes').first<{ n: number }>())!.n).toBe(0);
    expect((await post('/account/recipes/save', recipeForm({ locale: 'zz:xx' }), { cookie })).status).toBe(400);
  });
  it('escapes HTML in user content', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm({ title: '<script>alert(1)</script>' }), { cookie });
    const edit = await (await get(res.headers.get('location')!, cookie)).text();
    expect(edit).not.toContain('<script>alert(1)</script>');
    expect(edit).toContain('&lt;script&gt;');
  });
  it("keeps one user's drafts invisible and immutable to another user", async () => {
    const a = await signIn('a@example.com');
    const res = await post('/account/recipes/save', recipeForm(), { cookie: a });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(res.headers.get('location')!)![1]!;
    const b = await signIn('b@example.com');
    expect((await get(`/account/recipes/${id}/edit`, b)).status).toBe(404);
    expect((await post('/account/recipes/save', { ...recipeForm({ title: 'Hijack' }), id }, { cookie: b })).status).toBe(404);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie: b })).status).toBe(404);
    expect((await post(`/account/recipes/${id}/delete`, {}, { cookie: b })).status).toBe(404);
    expect(await (await get('/account', b)).text()).not.toContain('Abuela');
    expect((await DB.prepare('SELECT title FROM recipe_locales').first<{ title: string }>())!.title).toBe('Abuela Soup');
  });
  it('submit needs the rights box, notifies the owner once, locks editing, and never publishes', async () => {
    const cookie = await signIn();
    const noAttest = await post('/account/recipes/save', recipeForm({ attest: '' }), { cookie });
    const id0 = /recipes\/([a-z0-9]+)\/edit/.exec(noAttest.headers.get('location')!)![1]!;
    expect((await post(`/account/recipes/${id0}/submit`, {}, { cookie })).status).toBe(409);
    const ok = await post('/account/recipes/save', { ...recipeForm(), id: id0 }, { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(ok.headers.get('location')!)![1]!;
    const before = sent.length;
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    expect(sent.length).toBe(before + 1);
    expect(sent[sent.length - 1]!.to).toEqual(['owner@example.com']);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(409);
    expect((await get(`/account/recipes/${id}/edit`, cookie)).status).toBe(409);
    expect((await post('/account/recipes/save', { ...recipeForm({ title: 'Changed' }), id }, { cookie })).status).toBe(409);
    const row = await DB.prepare('SELECT l.status AS st, s.cleared_at AS c FROM recipe_locales l JOIN recipes r ON r.id=l.recipe_id JOIN sources s ON s.id=r.source_id').first<Record<string, unknown>>();
    expect(row!['st']).toBe('draft'); expect(row!['c']).toBeNull();
  });
  it('deletes a draft and its rows', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(res.headers.get('location')!)![1]!;
    expect((await post(`/account/recipes/${id}/delete`, {}, { cookie })).status).toBe(303);
    for (const t of ['recipes', 'recipe_locales', 'sources']) expect((await DB.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())!.n).toBe(0);
  });
  it('does not touch recipes without an owner (existing/MCP rows)', async () => {
    await DB.prepare("INSERT INTO sources (id,name,url,license,cleared_at) VALUES ('s1','n','https://x.example','CC0','2026-01-01')").run();
    await DB.prepare("INSERT INTO recipes (id,source_id,created_at) VALUES ('r1','s1','2026-01-01')").run();
    await DB.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,ingredients_json,steps_json,status) VALUES ('r1','us','en','Old','old','[]','[]','published')").run();
    const cookie = await signIn();
    expect((await get('/account/recipes/r1/edit', cookie)).status).toBe(404);
    expect((await post('/account/recipes/r1/delete', {}, { cookie })).status).toBe(404);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipes').first<{ n: number }>())!.n).toBe(1);
  });
});

describe('paste and import', () => {
  it('fills the form from pasted text without saving', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/paste', { text: 'Tea\nIngredients\nleaves\nInstructions\nSteep.' }, { cookie });
    const t = await res.text();
    expect(t).toContain('value="Tea"'); expect(t).toContain('leaves');
    expect((await DB.prepare('SELECT count(*) AS n FROM recipes').first<{ n: number }>())!.n).toBe(0);
  });
  it('refuses unsafe import links with a clear message', async () => {
    const cookie = await signIn();
    for (const url of ['http://example.com', 'https://127.0.0.1/', 'https://localhost/', 'https://user:p@example.com/', 'https://example.com:8080/']) {
      const res = await post('/account/recipes/import', { url }, { cookie });
      expect(res.status, url).toBe(400);
    }
  });
});

describe('submissions endpoint stays closed', () => {
  it('old unauthenticated API is still 503', async () => {
    const res = await app.request(`${ORIGIN}/api/v1/submissions`, { method: 'POST', body: '{}' }, env());
    expect(res.status).toBe(503);
  });
});
