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
function call(method: string, path: string, opts: { body?: unknown; token?: string; e?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  return app.request(`${ORIGIN}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }, env(opts.e));
}
const get = (p: string, o: { token?: string } = {}) => call('GET', p, o);
const post = (p: string, body?: unknown, o: { token?: string; e?: Record<string, unknown> } = {}) => call('POST', p, { ...o, body });
const put = (p: string, body: unknown, o: { token?: string } = {}) => call('PUT', p, { ...o, body });
const del = (p: string, o: { token?: string } = {}) => call('DELETE', p, o);
const lastCode = () => /code is (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;

async function signIn(email = 'cook@example.com'): Promise<string> {
  await post('/api/v1/auth/code', { email });
  const res = await post('/api/v1/auth/verify', { email, code: lastCode() });
  expect(res.status).toBe(200);
  const j = (await res.json()) as { token: string };
  expect(j.token).toMatch(/^[0-9a-f]{64}$/);
  return j.token;
}

const draftBody = (over: Record<string, unknown> = {}) => ({
  title: 'Abuela Soup', locale: 'us:en', intro: 'Warm.', ingredients: ['2 cups stock', '1 onion'], steps: ['Chop.', 'Simmer.'],
  prepMinutes: 10, cookMinutes: 30, baseServings: 4, displayName: 'Ana', sourceKind: 'original', attest: true, ...over,
});

async function seedPublished(ownerUserId: string | null = null) {
  await DB.prepare("INSERT INTO sources (id,name,url,license,cleared_at,notes) VALUES ('src-p','Test Kitchen','https://example.com','cc-by','2024-01-01T00:00:00Z',NULL)").run();
  await DB.prepare("INSERT INTO recipes (id,source_id,origin_country,image_key,created_at,tested_at,tested_by,prep_minutes,cook_minutes,rest_minutes,total_minutes,base_servings,category,owner_user_id,submitted_at,attested_at,author_name) VALUES ('rp1','src-p','us',NULL,'2024-01-02T00:00:00Z','2024-01-03T00:00:00Z','Test Kitchen',15,45,NULL,60,4,'soup',?,NULL,NULL,'Chef Ana')").bind(ownerUserId).run();
  await DB.prepare("INSERT INTO recipe_locales (recipe_id,country,lang,title,slug,intro,ingredients_json,steps_json,status) VALUES ('rp1','us','en','Tomato Soup','tomato-soup-rp1','A classic.','[\"2 cans tomato\",\"1 onion\"]','[\"Chop.\",\"Simmer.\",\"Serve.\"]','published')").run();
  await DB.prepare("INSERT INTO recipe_images (id,recipe_id,kind,step_index,r2_key,mime,bytes,width,height,style,source_name,source_url,license,cleared_at,created_at) VALUES ('img-hero','rp1','hero',NULL,'r2/hero.webp','image/webp',100,800,600,'photo','Test Kitchen','https://example.com','cc-by','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z')").run();
  await DB.prepare("INSERT INTO recipe_images (id,recipe_id,kind,step_index,r2_key,mime,bytes,width,height,style,source_name,source_url,license,cleared_at,created_at) VALUES ('img-step1','rp1','step',1,'r2/s1.webp','image/webp',100,800,600,'illustration','Test Kitchen','https://example.com','cc-by','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z')").run();
  // Uncleared rows must never leak into the JSON either.
  await DB.prepare("INSERT INTO recipe_images (id,recipe_id,kind,step_index,r2_key,mime,bytes,width,height,style,source_name,source_url,license,cleared_at,created_at) VALUES ('img-raw','rp1','step',0,'r2/raw.webp','image/webp',100,800,600,'photo','Test Kitchen','https://example.com','cc-by',NULL,'2024-01-01T00:00:00Z')").run();
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

describe('native app auth', () => {
  it('signs in with the emailed code and returns a bearer token for /me', async () => {
    const token = await signIn();
    const me = await get('/api/v1/me', { token });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe('cook@example.com');
    expect(me.headers.get('cache-control')).toBe('no-store');
    // Hash at rest: the raw token never reaches the database.
    const sess = await DB.prepare('SELECT id FROM sessions').first<{ id: string }>();
    expect(sess!.id).not.toBe(token);
    // Logout kills exactly this session.
    expect((await post('/api/v1/auth/logout', {}, { token })).status).toBe(200);
    expect((await get('/api/v1/me', { token })).status).toBe(401);
  });
  it('rejects missing and malformed bearer tokens', async () => {
    expect((await get('/api/v1/me')).status).toBe(401);
    expect((await get('/api/v1/me', { token: 'not-a-token' })).status).toBe(401);
    expect((await get('/api/v1/me/recipes')).status).toBe(401);
    expect((await del('/api/v1/me/account')).status).toBe(401);
  });
  it('caps wrong-code attempts and burns used codes', async () => {
    await post('/api/v1/auth/code', { email: 'a@example.com' });
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await post('/api/v1/auth/verify', { email: 'a@example.com', code: wrong })).status).toBe(400);
    expect((await post('/api/v1/auth/verify', { email: 'a@example.com', code: good })).status).toBe(400);
    await post('/api/v1/auth/code', { email: 'b@example.com' });
    const c2 = lastCode();
    expect((await post('/api/v1/auth/verify', { email: 'b@example.com', code: c2 })).status).toBe(200);
    expect((await post('/api/v1/auth/verify', { email: 'b@example.com', code: c2 })).status).toBe(400);
  });
  it('throttles per email and answers 503 when mail is not configured', async () => {
    for (let i = 0; i < 3; i++) expect((await post('/api/v1/auth/code', { email: 'a@example.com' })).status).toBe(200);
    expect((await post('/api/v1/auth/code', { email: 'a@example.com' })).status).toBe(429);
    expect((await post('/api/v1/auth/code', { email: 'z@example.com' }, { e: { RESEND_API_KEY: undefined } })).status).toBe(503);
  });
});

describe('own recipes', () => {
  it('creates, lists, updates and removes a private draft', async () => {
    const token = await signIn();
    const created = await post('/api/v1/me/recipes', draftBody(), { token });
    expect(created.status).toBe(201);
    const { id, slug } = (await created.json()) as { id: string; slug: string };
    expect(slug).toBe(`abuela-soup-${id}`);
    let list = (await (await get('/api/v1/me/recipes', { token })).json()) as { recipes: { id: string; state: string; title: string }[] };
    expect(list.recipes).toHaveLength(1);
    expect(list.recipes[0]).toMatchObject({ id, state: 'draft', title: 'Abuela Soup', country: 'us', lang: 'en' });
    expect((await put(`/api/v1/me/recipes/${id}`, draftBody({ title: 'Abuela Soup 2' }), { token })).status).toBe(200);
    list = (await (await get('/api/v1/me/recipes', { token })).json()) as typeof list;
    expect(list.recipes[0]!.title).toBe('Abuela Soup 2');
    expect((await del(`/api/v1/me/recipes/${id}`, { token })).status).toBe(200);
    list = (await (await get('/api/v1/me/recipes', { token })).json()) as typeof list;
    expect(list.recipes).toHaveLength(0);
    // The row stays for audit, marked rejected.
    const loc = await DB.prepare('SELECT status FROM recipe_locales WHERE recipe_id = ?').bind(id).first<{ status: string }>();
    expect(loc!.status).toBe('rejected');
  });
  it('validates like the HTML form and reports field errors', async () => {
    const token = await signIn();
    const res = await post('/api/v1/me/recipes', draftBody({ displayName: '', locale: 'xx:en' }), { token });
    expect(res.status).toBe(400);
    const { errors } = (await res.json()) as { errors: string[] };
    expect(errors.join(' ')).toContain('name to show as author');
    expect(errors.join(' ')).toContain('language from the list');
    expect((await post('/api/v1/me/recipes', draftBody({ sourceKind: 'adapted', sourceUrl: 'http://x.com' }), { token })).status).toBe(400);
    expect((await post('/api/v1/me/recipes', draftBody({ ingredients: [] }), { token })).status).toBe(400);
  });
  it('submits only attested drafts, then locks them', async () => {
    const token = await signIn();
    const noAttest = await post('/api/v1/me/recipes', draftBody({ attest: false }), { token });
    const { id: id1 } = (await noAttest.json()) as { id: string };
    expect((await post(`/api/v1/me/recipes/${id1}/submit`, {}, { token })).status).toBe(409);
    const attested = await post('/api/v1/me/recipes', draftBody({ title: 'Second Soup' }), { token });
    const { id } = (await attested.json()) as { id: string };
    const sub = await post(`/api/v1/me/recipes/${id}/submit`, {}, { token });
    expect(sub.status).toBe(200);
    expect(sent.some((m) => m.to.includes('owner@example.com') && m.subject.includes('Second Soup'))).toBe(true);
    expect((await post(`/api/v1/me/recipes/${id}/submit`, {}, { token })).status).toBe(409);
    expect((await put(`/api/v1/me/recipes/${id}`, draftBody(), { token })).status).toBe(409);
    expect((await del(`/api/v1/me/recipes/${id}`, { token })).status).toBe(404);
    const list = (await (await get('/api/v1/me/recipes', { token })).json()) as { recipes: { id: string; state: string }[] };
    expect(list.recipes.find((r) => r.id === id)!.state).toBe('submitted');
  });
  it('keeps other users away from a draft', async () => {
    const t1 = await signIn('one@example.com');
    const t2 = await signIn('two@example.com');
    const { id } = (await (await post('/api/v1/me/recipes', draftBody(), { token: t1 })).json()) as { id: string };
    expect((await put(`/api/v1/me/recipes/${id}`, draftBody(), { token: t2 })).status).toBe(404);
    expect((await post(`/api/v1/me/recipes/${id}/submit`, {}, { token: t2 })).status).toBe(404);
    expect((await del(`/api/v1/me/recipes/${id}`, { token: t2 })).status).toBe(404);
  });
});

describe('account deletion', () => {
  it('removes sign-in artifacts, withdraws non-published locales, keeps published credit', async () => {
    const token = await signIn();
    const me = ((await (await get('/api/v1/me', { token })).json()) as { user: { id: string } }).user;
    const { id: draftId } = (await (await post('/api/v1/me/recipes', draftBody(), { token })).json()) as { id: string };
    await seedPublished(me.id);
    const res = await del('/api/v1/me/account', { token });
    expect(res.status).toBe(200);
    expect((await get('/api/v1/me', { token })).status).toBe(401);
    expect(await DB.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>().then((r) => r!.n)).toBe(0);
    expect(await DB.prepare('SELECT count(*) AS n FROM sessions').first<{ n: number }>().then((r) => r!.n)).toBe(0);
    expect(await DB.prepare('SELECT count(*) AS n FROM auth_codes').first<{ n: number }>().then((r) => r!.n)).toBe(0);
    const draft = await DB.prepare('SELECT status FROM recipe_locales WHERE recipe_id = ?').bind(draftId).first<{ status: string }>();
    expect(draft!.status).toBe('rejected');
    const pub = await DB.prepare('SELECT status FROM recipe_locales WHERE recipe_id = ?').bind('rp1').first<{ status: string }>();
    expect(pub!.status).toBe('published');
    const owner = await DB.prepare('SELECT owner_user_id AS o, author_name AS a FROM recipes WHERE id = ?').bind('rp1').first<{ o: string | null; a: string }>();
    expect(owner!.o).toBeNull();
    expect(owner!.a).toBe('Chef Ana');
    // The published recipe is still served to readers.
    expect((await get('/api/v1/recipes/us/en/tomato-soup-rp1')).status).toBe(200);
  });
});

describe('published recipe detail', () => {
  it('serves the full published recipe with cleared images only', async () => {
    await seedPublished();
    const res = await get('/api/v1/recipes/us/en/tomato-soup-rp1');
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      recipe: { id: string; totalMinutes: number; category: string };
      locale: { title: string; ingredients: string[]; steps: string[] };
      heroImage: { url: string; style: string } | null;
      stepImages: ({ url: string; style: string } | null)[];
      source: { name: string; license: string };
    };
    expect(j.recipe).toMatchObject({ id: 'rp1', totalMinutes: 60, category: 'soup' });
    expect(j.locale.title).toBe('Tomato Soup');
    expect(j.locale.ingredients).toEqual(['2 cans tomato', '1 onion']);
    expect(j.locale.steps).toEqual(['Chop.', 'Simmer.', 'Serve.']);
    expect(j.heroImage).toEqual({ url: `${ORIGIN}/img/recipe/img-hero`, style: 'photo' });
    // Step 0 has only an uncleared image: stays null. Step 1 wins the cleared one.
    expect(j.stepImages).toEqual([null, { url: `${ORIGIN}/img/recipe/img-step1`, style: 'illustration' }, null]);
    expect(j.source).toMatchObject({ name: 'Test Kitchen', license: 'cc-by' });
  });
  it('404s drafts, unknown slugs and demo-seed rows', async () => {
    await seedPublished();
    expect((await get('/api/v1/recipes/us/en/nope')).status).toBe(404);
    expect((await get('/api/v1/recipes/mx/en/tomato-soup-rp1')).status).toBe(404);
    await DB.prepare("UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = 'rp1'").run();
    expect((await get('/api/v1/recipes/us/en/tomato-soup-rp1')).status).toBe(404);
    await DB.prepare("UPDATE recipe_locales SET status = 'published' WHERE recipe_id = 'rp1'").run();
    await DB.prepare("UPDATE sources SET license = 'internal-demo' WHERE id = 'src-p'").run();
    expect((await get('/api/v1/recipes/us/en/tomato-soup-rp1')).status).toBe(404);
  });
});
