import { beforeEach, describe, expect, it } from 'vitest';
import app from './index';
import { migratedD1All } from './testd1';

type Sent = { to: string[]; subject: string; text: string };
let DB: D1Database;
let sent: Sent[];
const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;

function env(extra: Record<string, unknown> = {}) {
  return { DB, CANONICAL_ORIGIN: ORIGIN, ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'true', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test', REVIEW_NOTIFY_TO: 'owner@example.com', ...extra };
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

describe('capture form (category-first + live checks)', () => {
  it('renders the category select before the title field with the bounded slugs', async () => {
    const cookie = await signIn();
    const res = await get('/account/recipes/new', cookie);
    const html = await res.text();
    const catIdx = html.indexOf('name="category"');
    const titleIdx = html.indexOf('name="title"');
    expect(catIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(catIdx);
    expect(html).toContain('soups-stews');
    expect(html).toContain('data-live-checks');
    expect(html).toContain('A sentence or two before the recipe');
  });
  it('saves a valid category on the recipe and rejects an unknown one to uncategorized', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm({ category: 'soups-stews' }), { cookie });
    expect(res.status).toBe(303);
    const row = await DB.prepare('SELECT category FROM recipes').first<{ category: string }>();
    expect(row!.category).toBe('soups-stews');
    const res2 = await post('/account/recipes/save', recipeForm({ title: 'Other Dish', category: 'not-a-real-slug' }), { cookie });
    expect(res2.status).toBe(303);
    const rows = await DB.prepare('SELECT category FROM recipes ORDER BY created_at').all<{ category: string | null }>();
    expect(rows.results[1]!.category).toBeNull();
  });
  it('localizes category options and check strings when the recipe language is Spanish', async () => {
    const cookie = await signIn();
    await post('/account/recipes/save', recipeForm({ locale: 'us:es', category: 'soups-stews' }), { cookie });
    const { id } = (await DB.prepare('SELECT id FROM recipes').first<{ id: string }>())!;
    const html = await (await get(`/account/recipes/${id}/edit`, cookie)).text();
    expect(html).toContain('<option value="soups-stews" selected>Sopas y guisos</option>');
    expect(html).toContain('¿Qué tipo de plato es?');
    expect(html).toContain('Ponle un nombre a la receta');
    expect(html).toContain('Una o dos frases antes de la receta');
  });
  it('data islands carry every re-localizable string (blank option + preamble included)', async () => {
    const cookie = await signIn();
    const html = await (await get('/account/recipes/new', cookie)).text();
    for (const frag of ['__unsure', '__prompt', '__preamble', '__preambleHint']) expect(html).toContain(frag);
    for (const frag of ['Aún no lo sé', 'Pas encore sûr', 'Not sure yet']) expect(html).toContain(frag);
    for (const frag of ['Una o dos frases antes de la receta', 'Une phrase ou deux avant la recette']) expect(html).toContain(frag);
    expect(html).toContain('data-preamble-label');
    expect(html).toContain('data-preamble-hint');
  });
  it('ships idle (neutral) check markup and all three locales of check strings', async () => {
    const cookie = await signIn();
    const html = await (await get('/account/recipes/new', cookie)).text();
    expect(html).toContain('id="capture-check-strings"');
    expect(html).toContain('id="capture-cat-labels"');
    for (const frag of ['Ponle un nombre', 'Donnez un nom', 'Give the recipe a name']) expect(html).toContain(frag);
    for (const frag of ['Sopas y guisos', 'Soupes et rago']) expect(html).toContain(frag);
  });
  it('prefills the category when editing a draft', async () => {
    const cookie = await signIn();
    await post('/account/recipes/save', recipeForm({ category: 'dumplings' }), { cookie });
    const { id } = (await DB.prepare('SELECT id FROM recipes').first<{ id: string }>())!;
    const res = await get(`/account/recipes/${id}/edit`, cookie);
    const html = await res.text();
    expect(html).toContain('<option value="dumplings" selected>');
  });
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
  it('invalidates the code on send failure and does not refund the mail budget', async () => {
    globalThis.fetch = (async () => new Response('no', { status: 500 })) as typeof fetch;
    expect((await post('/account/code', { email: 'a@example.com' })).status).toBe(503);
    expect((await DB.prepare('SELECT used FROM auth_codes').first<{ used: number }>())!.used).toBe(1);
    expect((await DB.prepare('SELECT count(*) AS n FROM mail_log').first<{ n: number }>())!.n).toBe(1);
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

describe('atomicity under concurrency', () => {
  it('10 concurrent uses of one code create exactly one session', async () => {
    await post('/account/code', { email: 'race@example.com' });
    const code = lastCode();
    const rs = await Promise.all(Array.from({ length: 10 }, () => post('/account/verify', { email: 'race@example.com', code })));
    expect(rs.filter((r) => r.status === 303)).toHaveLength(1);
    expect((await DB.prepare('SELECT count(*) AS n FROM sessions').first<{ n: number }>())!.n).toBe(1);
  });
  it('concurrent wrong guesses are capped at 5 and burn the code', async () => {
    await post('/account/code', { email: 'g@example.com' });
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 12 }, () => post('/account/verify', { email: 'g@example.com', code: wrong })));
    expect((await DB.prepare('SELECT attempts FROM auth_codes').first<{ attempts: number }>())!.attempts).toBe(5);
    expect((await post('/account/verify', { email: 'g@example.com', code: good })).status).toBe(400);
  });
  it('10 concurrent code requests for one email send at most 3', async () => {
    await Promise.all(Array.from({ length: 10 }, () => post('/account/code', { email: 'burst@example.com' })));
    expect(sent.length).toBe(3);
  });
  it('daily mail budget holds under concurrency and covers review notices', async () => {
    const now = Date.now();
    for (let i = 0; i < 31; i++) await DB.prepare("INSERT INTO mail_log (id,kind,created_at) VALUES (?,'code',?)").bind(`seed${i}`, now).run();
    await Promise.all(Array.from({ length: 10 }, (_, i) => post('/account/code', { email: `u${i}@example.com` })));
    expect(sent.length).toBe(1);
    expect((await DB.prepare('SELECT count(*) AS n FROM mail_log').first<{ n: number }>())!.n).toBe(32);
  });
  it('review notices stop at the overall cap but the submit still flags the draft', async () => {
    const cookie = await signIn();
    const sv = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(sv.headers.get('location')!)![1]!;
    const now = Date.now();
    for (let i = 0; i < 8; i++) await DB.prepare("INSERT OR IGNORE INTO mail_log (id,kind,created_at) VALUES (?,'notice',?)").bind(`s${i}`, now).run();
    const before = sent.length;
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    expect(sent.length).toBe(before);
    expect((await DB.prepare('SELECT submitted_at FROM recipes').first<{ submitted_at: string | null }>())!.submitted_at).toBeTruthy();
  });
  it('a failing save leaves the existing locale untouched (no delete-then-insert window)', async () => {
    const cookie = await signIn();
    const sv = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(sv.headers.get('location')!)![1]!;
    await DB.exec("CREATE TRIGGER boom BEFORE UPDATE ON recipe_locales BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const res = await post('/account/recipes/save', { ...recipeForm({ title: 'Changed' }), id }, { cookie });
    expect(res.status).toBe(500);
    const row = await DB.prepare('SELECT count(*) AS n, min(title) AS t FROM recipe_locales').first<{ n: number; t: string }>();
    expect(row!.n).toBe(1); expect(row!.t).toBe('Abuela Soup');
    const src = await DB.prepare('SELECT name FROM sources').first<{ name: string }>();
    expect(src!.name).toBe('Ana');
  });
  it('concurrent save and submit: a saved edit after submit is refused, content stays as submitted', async () => {
    const cookie = await signIn();
    const sv = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(sv.headers.get('location')!)![1]!;
    const [a, b] = await Promise.all([
      post(`/account/recipes/${id}/submit`, {}, { cookie }),
      post('/account/recipes/save', { ...recipeForm({ title: 'Edited late' }), id }, { cookie }),
    ]);
    const sub = await DB.prepare('SELECT submitted_at FROM recipes').first<{ submitted_at: string | null }>();
    expect(sub!.submitted_at).toBeTruthy();
    const t = (await DB.prepare('SELECT title FROM recipe_locales').first<{ title: string }>())!.title;
    // Either the edit landed before the submit (200/303 and title changed) or it was refused (409) and title is unchanged.
    expect(b.status === 409 ? t === 'Abuela Soup' : t === 'Edited late').toBe(true);
    const late = await post('/account/recipes/save', { ...recipeForm({ title: 'Too late' }), id }, { cookie });
    expect(late.status).toBe(409);
    expect((await DB.prepare('SELECT title FROM recipe_locales').first<{ title: string }>())!.title).toBe(t);
    expect(a.status).toBe(200);
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
  it('removing a draft hides it but deletes nothing', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(res.headers.get('location')!)![1]!;
    expect((await post(`/account/recipes/${id}/delete`, {}, { cookie })).status).toBe(303);
    for (const t of ['recipes', 'recipe_locales', 'sources']) expect((await DB.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())!.n).toBe(1);
    expect((await DB.prepare('SELECT status FROM recipe_locales').first<{ status: string }>())!.status).toBe('rejected');
    expect(await (await get('/account', cookie)).text()).not.toContain('Abuela');
    expect((await get(`/account/recipes/${id}/edit`, cookie)).status).toBe(404);
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

describe('review queue handoff', () => {
  it('MCP recipes.list can show submitted user recipes even with no notify address', async () => {
    const cookie = await signIn();
    const sv = await post('/account/recipes/save', recipeForm(), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(sv.headers.get('location')!)![1]!;
    await post(`/account/recipes/${id}/submit`, {}, { cookie, e: { REVIEW_NOTIFY_TO: undefined } });
    const rpc = (args: unknown) => app.request(`${ORIGIN}/api/admin/mcp`, { method: 'POST', headers: { authorization: 'Bearer test-admin-key-0000000000', 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'recipes.list', arguments: args } }) }, env({ ADMIN_MCP_API_KEY: 'test-admin-key-0000000000' }));
    const res = await rpc({ submitted: true });
    const txt = await res.text();
    expect(txt).toContain(id);
    expect(txt).toContain('submitted_at');
  });
});

describe('old codes and failed saves (reviewer repros, inverted)', () => {
  it('an older code is dead once a newer one is issued or used', async () => {
    await post('/account/code', { email: 'old@example.com' }); const first = lastCode();
    await new Promise((r) => setTimeout(r, 5));
    await post('/account/code', { email: 'old@example.com' }); const second = lastCode();
    expect((await post('/account/verify', { email: 'old@example.com', code: first })).status).toBe(400);
    expect((await post('/account/verify', { email: 'old@example.com', code: second })).status).toBe(303);
    expect((await post('/account/verify', { email: 'old@example.com', code: first })).status).toBe(400);
  });
  it('replay across 10 concurrent uses for an existing account yields one session', async () => {
    await signIn('a@example.com');
    await post('/account/code', { email: 'a@example.com' });
    const code = lastCode();
    const rs = await Promise.all(Array.from({ length: 10 }, () => post('/account/verify', { email: 'a@example.com', code })));
    expect(rs.filter((r) => r.status === 303)).toHaveLength(1);
  });
});

describe('private user drafts are invisible to MCP keys', () => {
  const ADMIN = 'test-admin-key-0000000000', VIEW = 'test-read-key-00000000000', EDIT = 'test-editor-key-000000000';
  const mcp = async (token: string, name: string, args: unknown) => (await app.request(`${ORIGIN}/api/admin/mcp`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }, env({ ADMIN_MCP_API_KEY: ADMIN, MCP_READ_KEY: VIEW, MCP_NAMED_KEYS: JSON.stringify([{ name: 'ed', key: EDIT, role: 'editor' }]) }))).text();
  async function seed(submit: boolean) {
    const cookie = await signIn(`p${Math.random().toString(36).slice(2, 7)}@example.com`);
    const sv = await post('/account/recipes/save', recipeForm({ title: 'Secret Stew' }), { cookie });
    const id = /recipes\/([a-z0-9]+)\/edit/.exec(sv.headers.get('location')!)![1]!;
    if (submit) await post(`/account/recipes/${id}/submit`, {}, { cookie });
    const sourceId = (await DB.prepare('SELECT source_id AS s FROM recipes WHERE id = ?').bind(id).first<{ s: string }>())!.s;
    return { id, sourceId };
  }
  it('unsubmitted draft: hidden from viewer, editor AND admin on list/get/sources/writes', async () => {
    const { id, sourceId } = await seed(false);
    for (const key of [VIEW, EDIT, ADMIN]) {
      expect(await mcp(key, 'recipes.list', {})).not.toContain('Secret Stew');
      expect(await mcp(key, 'recipes.list', { status: 'draft' })).not.toContain(id);
      expect(await mcp(key, 'sources.list', {})).not.toContain(sourceId);
      expect(await mcp(key, 'recipes.get', { id })).toContain('not found');
    }
    expect(await mcp(EDIT, 'recipes.update_draft', { id, title: 'x' })).toContain('not found');
    expect(await mcp(ADMIN, 'recipes.publish', { id })).toContain('not found');
    expect(await mcp(ADMIN, 'sources.clear_rights', { id: sourceId })).toContain('not found');
    expect(await mcp(ADMIN, 'sources.update', { id: sourceId, name: 'x' })).toContain('not found');
    expect((await DB.prepare('SELECT title FROM recipe_locales').first<{ title: string }>())!.title).toBe('Secret Stew');
  });
  it('submitted draft: admin review queue only; viewer/editor still blind', async () => {
    const { id } = await seed(true);
    expect(await mcp(ADMIN, 'recipes.list', { submitted: true })).toContain(id);
    expect(await mcp(ADMIN, 'recipes.get', { id })).toContain('Secret Stew');
    for (const key of [VIEW, EDIT]) {
      expect(await mcp(key, 'recipes.list', { submitted: true })).not.toContain(id);
      expect(await mcp(key, 'recipes.get', { id })).toContain('not found');
    }
  });
  it('slug-collision errors do not reveal a private recipe id', async () => {
    const { id } = await seed(false);
    const slug = (await DB.prepare('SELECT slug FROM recipe_locales').first<{ slug: string }>())!.slug;
    const body = { source: { name: 'n', url: 'https://example.com', license: 'CC0' }, locales: [{ country: 'us', lang: 'en', title: 'Whatever', slug, ingredients: ['a'], steps: ['b'] }] };
    expect(await mcp(EDIT, 'recipes.create_draft', body)).not.toContain(id);
  });
  it('once an admin publishes a user recipe it is normal public content again', async () => {
    const { id, sourceId } = await seed(true);
    await DB.prepare("UPDATE sources SET cleared_at = '2026-01-01' WHERE id = ?").bind(sourceId).run();
    await DB.prepare("UPDATE recipe_locales SET status = 'published' WHERE recipe_id = ?").bind(id).run();
    expect(await mcp(VIEW, 'recipes.list', {})).toContain(id);
  });
});

describe('housekeeping', () => {
  it('cleans expired sign-in artifacts and never touches recipes or users', async () => {
    const cookie = await signIn();
    await post('/account/recipes/save', recipeForm(), { cookie });
    await DB.prepare('UPDATE auth_codes SET expires_at = 1').run();
    await DB.prepare('UPDATE sessions SET expires_at = 1').run();
    await DB.prepare('UPDATE mail_log SET created_at = 1').run();
    await post('/account/code', { email: 'fresh@example.com' });
    expect((await DB.prepare('SELECT count(*) AS n FROM sessions').first<{ n: number }>())!.n).toBe(0);
    expect((await DB.prepare('SELECT count(*) AS n FROM auth_codes').first<{ n: number }>())!.n).toBe(1);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipes').first<{ n: number }>())!.n).toBe(1);
    expect((await DB.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>())!.n).toBe(1);
  });
});

describe('limits and credit', () => {
  it('concurrent creates cannot exceed the 50-draft cap, and nothing partial is left', async () => {
    const cookie = await signIn();
    const uid = (await DB.prepare('SELECT id FROM users').first<{ id: string }>())!.id;
    for (let i = 0; i < 48; i++) {
      await DB.prepare("INSERT INTO sources (id,name,url,license) VALUES (?, 'n','https://x.example','user-original')").bind(`ss${i}`).run();
      await DB.prepare("INSERT INTO recipes (id,source_id,created_at,owner_user_id) VALUES (?,?,'t',?)").bind(`rr${i}`, `ss${i}`, uid).run();
      await DB.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,ingredients_json,steps_json,status) VALUES (?,'us','en','t',?,'[]','[]','draft')").bind(`rr${i}`, `t-rr${i}`).run();
    }
    const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => post('/account/recipes/save', recipeForm({ title: `Race ${i}` }), { cookie })));
    expect(rs.filter((r) => r.status === 303)).toHaveLength(2);
    expect(rs.filter((r) => r.status === 400)).toHaveLength(4);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipes').first<{ n: number }>())!.n).toBe(50);
    expect((await DB.prepare("SELECT count(*) AS n FROM sources WHERE id LIKE 'src-%'").first<{ n: number }>())!.n).toBe(2);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipe_locales').first<{ n: number }>())!.n).toBe(50);
  });
  it('keeps each recipe\'s own author credit when another recipe uses a different name', async () => {
    const cookie = await signIn();
    const a = await post('/account/recipes/save', recipeForm({ title: 'First', display_name: 'Ana' }), { cookie });
    const idA = /recipes\/([a-z0-9]+)\/edit/.exec(a.headers.get('location')!)![1]!;
    await post('/account/recipes/save', recipeForm({ title: 'Second', display_name: 'Someone Else' }), { cookie });
    const t = await (await get(`/account/recipes/${idA}/edit`, cookie)).text();
    expect(t).toContain('value="Ana"'); expect(t).not.toContain('value="Someone Else"');
  });
  it('rejects oversized bodies with 413 before parsing', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/paste', { text: 'x'.repeat(300_000) }, { cookie });
    expect(res.status).toBe(413);
    const chunked = await app.request(`${ORIGIN}/account/code`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=' + 'a'.repeat(400_000) }, env());
    expect(chunked.status).toBe(413);
  });
});

describe('budget order, concurrent issuance, removal frees a slot', () => {
  it('hard allocation: 32 codes and 8 notices are independent, 40 total', async () => {
    const now = Date.now();
    for (let i = 0; i < 8; i++) await DB.prepare("INSERT INTO mail_log (id,kind,created_at) VALUES (?,'notice',?)").bind(`n${i}`, now).run();
    for (let i = 0; i < 31; i++) await DB.prepare("INSERT INTO mail_log (id,kind,created_at) VALUES (?,'code',?)").bind(`c${i}`, now).run();
    // 8 notices already used: a code is still allowed (31 < 32), the next is refused
    expect((await post('/account/code', { email: 'one@example.com' })).status).toBe(200);
    expect((await post('/account/code', { email: 'two@example.com' })).status).toBe(503);
    expect((await DB.prepare('SELECT count(*) AS n FROM mail_log').first<{ n: number }>())!.n).toBe(40);
  });
  it('per-email rejections do not spend the site-wide mail budget', async () => {
    for (let i = 0; i < 3; i++) await post('/account/code', { email: 'spam@example.com' });
    const before = (await DB.prepare('SELECT count(*) AS n FROM mail_log').first<{ n: number }>())!.n;
    for (let i = 0; i < 10; i++) expect((await post('/account/code', { email: 'spam@example.com' })).status).toBe(429);
    expect((await DB.prepare('SELECT count(*) AS n FROM mail_log').first<{ n: number }>())!.n).toBe(before);
  });
  it('when the site budget is exhausted the code is killed, not sent', async () => {
    const now = Date.now();
    for (let i = 0; i < 32; i++) await DB.prepare("INSERT INTO mail_log (id,kind,created_at) VALUES (?,'code',?)").bind(`b${i}`, now).run();
    expect((await post('/account/code', { email: 'late@example.com' })).status).toBe(503);
    expect(sent.length).toBe(0);
    expect((await DB.prepare('SELECT used FROM auth_codes').first<{ used: number }>())!.used).toBe(1);
  });
  it('concurrent issuance leaves exactly one live code (the newest), never zero', async () => {
    await Promise.all(Array.from({ length: 3 }, () => post('/account/code', { email: 'multi@example.com' })));
    const live = await DB.prepare('SELECT count(*) AS n FROM auth_codes WHERE used = 0').first<{ n: number }>();
    expect(live!.n).toBe(1);
  });
  it('removing a draft frees an active slot, with a lifetime row cap behind it', async () => {
    const cookie = await signIn();
    const uid = (await DB.prepare('SELECT id FROM users').first<{ id: string }>())!.id;
    for (let i = 0; i < 50; i++) {
      await DB.prepare("INSERT INTO sources (id,name,url,license) VALUES (?, 'n','https://x.example','user-original')").bind(`as${i}`).run();
      await DB.prepare("INSERT INTO recipes (id,source_id,created_at,owner_user_id) VALUES (?,?,'t',?)").bind(`ar${i}`, `as${i}`, uid).run();
      await DB.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,ingredients_json,steps_json,status) VALUES (?,'us','en','t',?,'[]','[]','draft')").bind(`ar${i}`, `t-ar${i}`).run();
    }
    expect((await post('/account/recipes/save', recipeForm(), { cookie })).status).toBe(400);
    expect((await post('/account/recipes/ar0/delete', {}, { cookie })).status).toBe(303);
    expect((await post('/account/recipes/save', recipeForm(), { cookie })).status).toBe(303);
    await DB.prepare("UPDATE recipe_locales SET status = 'rejected'").run();
    for (let i = 0; i < 450; i++) {
      await DB.prepare("INSERT INTO sources (id,name,url,license) VALUES (?, 'n','https://x.example','user-original')").bind(`xs${i}`).run();
      await DB.prepare("INSERT INTO recipes (id,source_id,created_at,owner_user_id) VALUES (?,?,'t',?)").bind(`xr${i}`, `xs${i}`, uid).run();
    }
    expect((await post('/account/recipes/save', recipeForm({ title: 'Over lifetime' }), { cookie })).status).toBe(400);
  });
});

describe('odd titles', () => {
  it('emoji-only and very long titles save with unique slugs', async () => {
    const cookie = await signIn();
    const a = await post('/account/recipes/save', recipeForm({ title: '🍳🍳🍳' }), { cookie });
    expect(a.status).toBe(303);
    const long = 'a-'.repeat(65) + 'x';
    const b = await post('/account/recipes/save', recipeForm({ title: long }), { cookie });
    const c2 = await post('/account/recipes/save', recipeForm({ title: long }), { cookie });
    expect([b.status, c2.status]).toEqual([303, 303]);
    const rows = await DB.prepare('SELECT slug FROM recipe_locales').all<{ slug: string }>();
    expect(rows.results).toHaveLength(3);
    expect(new Set(rows.results.map((r) => r.slug)).size).toBe(3);
    for (const r of rows.results) expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('privacy page', () => {
  it('describes the account cookie and Resend instead of claiming no cookies', async () => {
    const t = await (await get('/privacy')).text();
    expect(t).toContain('__Host-2y_sid'); expect(t).toContain('Resend'); expect(t).not.toContain('2yolks sets no cookies');
  });
});

describe('link import is off by default', () => {
  it('hides the form and refuses the route unless IMPORT_ENABLED=true', async () => {
    const cookie = await signIn();
    const off = { IMPORT_ENABLED: undefined };
    const page = await app.request(`${ORIGIN}/account/recipes/new`, { headers: { cookie } }, env(off));
    const html = await page.text();
    expect(html).not.toContain('action="/account/recipes/import"');
    expect(html).toContain('not available yet');
    const res = await post('/account/recipes/import', { url: 'https://example.com/r' }, { cookie, e: off });
    expect(res.status).toBe(404);
  });
});

describe('submissions endpoint stays closed', () => {
  it('old unauthenticated API is still 503', async () => {
    const res = await app.request(`${ORIGIN}/api/v1/submissions`, { method: 'POST', body: '{}' }, env());
    expect(res.status).toBe(503);
  });
});

describe('account i18n (en/es/fr)', () => {
  const code6 = (text: string) => /\b(\d{6})\b/.exec(text)![1]!;

  it('renders the sign-in page in Spanish and French, defaulting unknown values to English', async () => {
    const es = await (await get('/account?lang=es')).text();
    expect(es).toContain('lang="es"');
    expect(es).toContain('Tu cuenta de 2yolks');
    expect(es).toContain('Envíame un código');
    expect(es).toContain('action="/account/code?lang=es"');
    expect(es).toContain('/account?lang=en');
    expect(es).toContain('/account?lang=fr');
    const fr = await (await get('/account?lang=fr')).text();
    expect(fr).toContain('lang="fr"');
    expect(fr).toContain('Votre compte 2yolks');
    expect(fr).toContain('M’envoyer un code');
    const bad = await (await get('/account?lang=de')).text();
    expect(bad).toContain('Your 2yolks account');
    // site chrome (footer) follows the page language too
    expect(es).toContain('>Acerca de<');
    expect(es).toContain('>Cómo probamos<');
    expect(es).toContain('>Privacidad<');
    expect(es).not.toContain('About / Acerca de');
    expect(fr).toContain('>À propos<');
    expect(fr).toContain('>Comment nous testons<');
    expect(fr).toContain('>Confidentialité<');
    expect(fr).not.toContain('About / Acerca de');
    expect(bad).toContain('>Privacy<');
  });

  it('runs the whole sign-in flow in Spanish, including the localized code email', async () => {
    const res = await post('/account/code?lang=es', { email: 'cook@example.com' });
    const html = await res.text();
    expect(html).toContain('Revisa tu correo');
    expect(html).toContain('action="/account/verify?lang=es"');
    expect(sent[0]!.subject).toMatch(/^Tu código de 2yolks: \d{6}$/);
    expect(sent[0]!.text).toContain('Tu código de inicio de sesión de 2yolks es');
    const code = code6(sent[0]!.subject);
    const v = await post('/account/verify?lang=es', { email: 'cook@example.com', code });
    expect(v.status).toBe(303);
    expect(v.headers.get('location')).toBe('/account?lang=es');
    const cookie = v.headers.get('set-cookie')!.split(';')[0]!;
    const home = await (await get('/account?lang=es', cookie)).text();
    expect(home).toContain('Tus recetas');
    expect(home).toContain('Cerrar sesión');
    expect(home).toContain('Añadir una receta');
  });

  it('rejects a wrong code with a localized error', async () => {
    await post('/account/code?lang=fr', { email: 'cook@example.com' });
    const v = await post('/account/verify?lang=fr', { email: 'cook@example.com', code: '000000' });
    expect(await v.text()).toContain('Ce code n’est pas le bon.');
  });

  it('renders the draft form in French and keeps the language on save errors', async () => {
    const cookie = await signIn();
    const form = await (await get('/account/recipes/new?lang=fr', cookie)).text();
    expect(form).toContain('Nom de la recette');
    expect(form).toContain('Enregistrer le brouillon privé');
    expect(form).toContain('J’ai écrit cette recette ou j’ai le droit de la partager');
    expect(form).toContain('action="/account/recipes/save?lang=fr"');
    // capture chrome still follows the RECIPE language (C1 design):
    expect(form).toContain('What kind of dish is it?');
    const bad = await post('/account/recipes/save?lang=fr', recipeForm({ display_name: '' }), { cookie });
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain('Ajoutez le nom affiché comme auteur.');
  });

  it('runs save, submit and removal in Spanish with localized status and redirects', async () => {
    const cookie = await signIn();
    const res = await post('/account/recipes/save?lang=es', recipeForm(), { cookie });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toMatch(/\/account\/recipes\/[a-z0-9]+\/edit\?saved=1&lang=es/);
    const home = await (await get('/account?lang=es', cookie)).text();
    expect(home).toContain('Borrador privado');
    const { id } = (await DB.prepare('SELECT id FROM recipes').first<{ id: string }>())!;
    const sub = await post(`/account/recipes/${id}/submit?lang=es`, {}, { cookie });
    expect(await sub.text()).toContain('Gracias, ya la tenemos');
    const home2 = await (await get('/account?lang=es', cookie)).text();
    expect(home2).toContain('Enviada a revisión');
    const del = await post(`/account/recipes/${id}/delete?lang=es`, {}, { cookie });
    expect(del.status).toBe(404);
    expect(await del.text()).toContain('ya fue enviado a revisión');
  });
});
