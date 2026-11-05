// G2 all-writer fence regressions (design/0010 + 0011 plan, test-only prep).
// EVERY path that writes consent-covered content tables must move the 0010
// content fence, so a permission form displayed before the write conflicts
// (409) and seals nothing. Writers covered: account form save/submit/delete,
// native app API save/submit/delete, MCP recipes.update_draft / add_locale /
// set_image / sources.update / sources.clear_rights / publish / unpublish,
// translations.mark_reviewed. Plus: a failed guarded publish moves nothing,
// one recipe's writes never trip another recipe's fence, and a structural
// inventory pins the exact trigger set so future migrations extend it.
// Adoption of legacy writers into the revision model is a separate G2 step
// (design/0011); the fence is what makes the interim safe.
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from './index';
import { makeD1 } from './testd1';
import { buildSnapshotFromLive, saveRevision, recordConsent, publishRevision } from './consent';

type Sent = { to: string[]; subject: string; text: string };
let DB: D1Database;
let sent: Sent[];
const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;
const ADMIN_KEY = 'test-admin-key-0000000000';
const EDITOR_KEY = 'test-editor-key-000000000';
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const IMAGE_META = { sourceName: '2yolks test', sourceUrl: 'https://example.com/img', license: 'CC0-1.0', style: 'graphic', rightsConfirmed: true };

function makeR2() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    objects,
    async put(key: string, value: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
      objects.set(key, { bytes: value, contentType: opts?.httpMetadata?.contentType });
      return { key };
    },
    async get(key: string) {
      const o = objects.get(key);
      if (!o) return null;
      return { body: new Response(o.bytes.slice().buffer as ArrayBuffer).body, httpMetadata: { contentType: o.contentType } };
    },
  };
}
let R2 = makeR2();

function env(extra: Record<string, unknown> = {}) {
  return {
    DB, CANONICAL_ORIGIN: ORIGIN, ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'false',
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    RESEND_API_KEY: 're_test', REVIEW_NOTIFY_TO: 'owner@example.com',
    CONSENT_FLOW_ENABLED: 'true',
    ADMIN_MCP_API_KEY: ADMIN_KEY, MCP_READ_KEY: 'test-read-key-00000000000',
    MCP_NAMED_KEYS: JSON.stringify([{ name: 'editor-1', key: EDITOR_KEY, role: 'editor' }]),
    IMAGES: R2,
    ...extra,
  };
}
function post(path: string, form: Record<string, string>, opts: { cookie?: string; e?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN };
  if (opts.cookie) headers['cookie'] = opts.cookie;
  return app.request(`${ORIGIN}${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env(opts.e));
}
function get(path: string, cookie: string, e?: Record<string, unknown>) {
  return app.request(`${ORIGIN}${path}`, { headers: { cookie } }, env(e));
}
function api(method: string, path: string, opts: { body?: unknown; token?: string; e?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  return app.request(`${ORIGIN}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }, env(opts.e));
}
async function toolCall(token: string, name: string, args: Record<string, unknown>, e: Record<string, unknown> = {}) {
  const res = await app.request(`${ORIGIN}/api/admin/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }, env(e));
  const body = (await res.json()) as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { code: number; message: string } };
  const text = body.result?.content?.[0]?.text;
  return { status: res.status, rpcError: body.error, isError: body.result?.isError === true, data: text ? (JSON.parse(text) as Record<string, unknown>) : undefined };
}
const lastCode = () => /code is (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;

async function signIn(email: string): Promise<string> {
  await post('/account/code', { email });
  const res = await post('/account/verify', { email, code: lastCode() });
  expect(res.status).toBe(303);
  return res.headers.get('set-cookie')!.split(';')[0]!;
}
async function signInNative(email: string): Promise<string> {
  await api('POST', '/api/v1/auth/code', { body: { email } });
  const res = await api('POST', '/api/v1/auth/verify', { body: { email, code: lastCode() } });
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}
async function makeDraft(cookie: string): Promise<string> {
  const res = await post('/account/recipes/save', {
    title: 'Abuela Soup', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', category: 'soups-stews',
  }, { cookie });
  expect(res.status).toBe(303);
  return /\/account\/recipes\/([^/]+)\/edit/.exec(res.headers.get('location')!)![1]!;
}
async function shownHash(id: string, cookie: string): Promise<{ hash: string; seq: string }> {
  const html = await (await get(`/account/recipes/${id}/permission`, cookie)).text();
  const hash = /name="shown_hash" value="([0-9a-f]{64})"/.exec(html);
  const seq = /name="shown_seq" value="(\d+)"/.exec(html);
  if (!hash || !seq) throw new Error('displayed-state binding missing from the form');
  return { hash: hash[1]!, seq: seq[1]! };
}
const fenceSeq = async (id: string) =>
  ((await DB.prepare(`SELECT seq FROM recipe_content_fence WHERE recipe_id = ?`).bind(id).first<{ seq: number }>())?.seq ?? 0);
const sealed = async (id: string) =>
  (await DB.prepare(`SELECT count(*) n FROM recipe_revisions WHERE recipe_id = ?`).bind(id).first<{ n: number }>())!.n;
const staleGrant = (id: string, cookie: string, sh: { hash: string; seq: string }) =>
  post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh.hash, shown_seq: sh.seq }, { cookie });

/** Core G2 assertion: writer moved the fence, the stale form conflicts, nothing was sealed. */
async function expectFence409(id: string, cookie: string, sh: { hash: string; seq: string }, expectedSealed = 0) {
  expect(await fenceSeq(id)).toBeGreaterThan(Number(sh.seq));
  expect((await staleGrant(id, cookie, sh)).status).toBe(409);
  expect(await sealed(id)).toBe(expectedSealed);
}

async function userId(email: string) {
  return (await DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first<{ id: string }>())!.id;
}
/** Publish the recipe's current live state through the service layer (consent + request + guard). */
async function publishCurrent(id: string, uid: string) {
  const snap = await buildSnapshotFromLive(DB, id);
  expect(snap).not.toBeNull();
  expect(await saveRevision(DB, id, uid, 'rev-1', 0, { json: snap!.json, hash: snap!.hash })).toEqual({ ok: true });
  expect(await recordConsent(DB, id, { id: 'ce-1', revisionId: 'rev-1', expectedSeq: 0, event: 'grant', userId: uid, licenseVersion: 'public-v1', licenseLang: 'en', scope: 'text' })).toEqual({ ok: true });
  expect(await publishRevision(DB, id, 'rev-1', uid, 'public-v1', 'en', 'preq-1')).toEqual({ ok: true });
}

beforeEach(() => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  // Design SQL is test-only preparation, NOT a live DB apply.
  for (const file of ['0007-consent-revisions.sql', '0008-consent-scope.sql', '0009-image-provenance.sql', '0010-content-fence.sql']) {
    sqlite.exec(readFileSync(new URL(`../../../design/${file}`, import.meta.url), 'utf8'));
  }
  DB = makeD1(sqlite);
  sent = [];
  R2 = makeR2();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

describe('G2 all-writer fence regressions', () => {
  it('account save route (legacy draft edit)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    const res = await post('/account/recipes/save', {
      id, title: 'Edited Soup', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
      prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', category: 'soups-stews',
    }, { cookie });
    expect(res.status).toBe(303);
    await expectFence409(id, cookie, sh);
  });

  it('account submit route', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    await expectFence409(id, cookie, sh);
  });

  it('account delete route retires the draft (stale form 404s)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    await post(`/account/recipes/${id}/delete`, {}, { cookie });
    expect(await fenceSeq(id)).toBeGreaterThan(Number(sh.seq));
    expect((await staleGrant(id, cookie, sh)).status).toBe(404);
    expect(await sealed(id)).toBe(0);
  });

  it('native PUT /me/recipes/:id', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    const token = await signInNative('cook@example.com');
    const res = await api('PUT', `/api/v1/me/recipes/${id}`, {
      body: { title: 'Edited natively', intro: 'Warm.', ingredients: ['2 cups stock', '1 onion'], steps: ['Chop.', 'Simmer.'], prepMinutes: 10, cookMinutes: 30, baseServings: 4, displayName: 'Ana', attest: true },
      token,
    });
    expect(res.status).toBe(200);
    await expectFence409(id, cookie, sh);
  });

  it('native POST /me/recipes/:id/submit', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    const token = await signInNative('cook@example.com');
    expect((await api('POST', `/api/v1/me/recipes/${id}/submit`, { token })).status).toBe(200);
    await expectFence409(id, cookie, sh);
  });

  it('native DELETE /me/recipes/:id retires the draft (stale form 404s)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    const token = await signInNative('cook@example.com');
    expect((await api('DELETE', `/api/v1/me/recipes/${id}`, { token })).status).toBe(200);
    expect(await fenceSeq(id)).toBeGreaterThan(Number(sh.seq));
    expect((await staleGrant(id, cookie, sh)).status).toBe(404);
    expect(await sealed(id)).toBe(0);
  });

  // Privacy boundary: the admin MCP never sees a private user draft - an owned
  // recipe with no published locale is 404 'not found' to MCP until it is
  // submitted (and to non-admin keys even then). So every MCP writer case
  // submits first and uses the admin key.
  it('MCP recipes.update_draft (admin, submitted draft)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const sh = await shownHash(id, cookie);
    const res = await toolCall(ADMIN_KEY, 'recipes.update_draft', { id, locales: [{ country: 'us', lang: 'en', title: 'MCP edit' }], confirmed: true });
    expect(res.isError).toBe(false);
    await expectFence409(id, cookie, sh);
  });

  it('MCP recipes.add_locale (admin, submitted draft)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const sh = await shownHash(id, cookie);
    const res = await toolCall(ADMIN_KEY, 'recipes.add_locale', {
      id, confirmed: true,
      locale: { country: 'mx', lang: 'es', title: 'Sopa de la abuela', intro: 'Caliente.', ingredients: ['2 tazas de caldo', '1 cebolla'], steps: ['Picar.', 'Hervir.'], translationOf: 'us/en', translationMethod: 'human' },
    });
    expect(res.isError).toBe(false);
    await expectFence409(id, cookie, sh);
  });

  it('MCP recipes.set_image (admin + R2, submitted draft)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const sh = await shownHash(id, cookie);
    const res = await toolCall(ADMIN_KEY, 'recipes.set_image', { id, imageBase64: PNG_1X1, ...IMAGE_META, confirmed: true });
    expect(res.isError).toBe(false);
    await expectFence409(id, cookie, sh);
  });

  it('MCP sources.update (admin, submitted draft)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const sh = await shownHash(id, cookie);
    const src = (await DB.prepare(`SELECT source_id s FROM recipes WHERE id = ?`).bind(id).first<{ s: string }>())!.s;
    const res = await toolCall(ADMIN_KEY, 'sources.update', { id: src, name: 'Renamed Kitchen', confirmed: true });
    expect(res.isError).toBe(false);
    await expectFence409(id, cookie, sh);
  });

  it('MCP sources.clear_rights (admin, submitted draft)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const sh = await shownHash(id, cookie);
    const src = (await DB.prepare(`SELECT source_id s FROM recipes WHERE id = ?`).bind(id).first<{ s: string }>())!.s;
    const res = await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: src, confirmed: true, notes: 'rights reviewed' });
    expect(res.isError).toBe(false);
    await expectFence409(id, cookie, sh);
  });

  it('translations.mark_reviewed moves the fence even though the content hash is unchanged', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const uid = await userId('cook@example.com');
    await publishCurrent(id, uid); // original us:en published; mark_reviewed requires a published source
    const added = await toolCall(EDITOR_KEY, 'recipes.add_locale', {
      id, confirmed: true,
      locale: { country: 'mx', lang: 'es', title: 'Sopa de la abuela', intro: 'Caliente.', ingredients: ['2 tazas de caldo', '1 cebolla'], steps: ['Picar.', 'Hervir.'], translationOf: 'us/en', translationMethod: 'human' },
    });
    expect(added.isError).toBe(false);
    const sh = await shownHash(id, cookie);
    const stamped = await toolCall(ADMIN_KEY, 'translations.mark_reviewed', { id, country: 'mx', lang: 'es', confirmed: true, note: 'Compared against us/en line by line' }, { MCP_TRANSLATION_REVIEW: '1' });
    expect(stamped.isError).toBe(false);
    // the review stamp is NOT canonical content: the hash alone would have let the stale form through
    expect((await buildSnapshotFromLive(DB, id))!.hash).toBe(sh.hash);
    await expectFence409(id, cookie, sh, 1);
  });

  it('MCP recipes.publish on an unconsented submitted draft is aborted by the guard and moves nothing', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const src = (await DB.prepare(`SELECT source_id s FROM recipes WHERE id = ?`).bind(id).first<{ s: string }>())!.s;
    expect((await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: src, confirmed: true, notes: 'rights reviewed' })).isError).toBe(false);
    const before = await fenceSeq(id);
    const res = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(res.isError).toBe(true);
    // the MCP endpoint deliberately returns a generic write-failed body; the
    // fail-closed proof is the state: still draft, fence unmoved, nothing sealed
    expect(JSON.stringify(res.data)).toContain('write failed before commit');
    expect((await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(id).first<{ status: string }>())!.status).toBe('draft');
    expect(await fenceSeq(id)).toBe(before);
    expect(await sealed(id)).toBe(0);
  });

  it('MCP recipes.unpublish after grant+publish moves the fence', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    expect((await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh.hash, shown_seq: sh.seq }, { cookie })).status).toBe(200);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const rev = (await DB.prepare(`SELECT id FROM recipe_revisions WHERE recipe_id = ?`).bind(id).first<{ id: string }>())!.id;
    await DB.prepare(`INSERT INTO users (id, email, created_at) VALUES ('admin-1', 'admin@example.com', '2026-01-01')`).run();
    expect(await publishRevision(DB, id, rev, 'admin-1', 'public-v1', 'en', 'preq-1')).toEqual({ ok: true });
    expect((await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(id).first<{ status: string }>())!.status).toBe('published');
    const before = await fenceSeq(id);
    const res = await toolCall(ADMIN_KEY, 'recipes.unpublish', { id, country: 'us', lang: 'en', confirmed: true });
    expect(res.isError).toBe(false);
    expect((await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(id).first<{ status: string }>())!.status).toBe('draft');
    expect(await fenceSeq(id)).toBeGreaterThan(before);
    expect(await sealed(id)).toBe(1);
  });

  it("one recipe's writes never trip another recipe's fence", async () => {
    const cookie = await signIn('cook@example.com');
    const id1 = await makeDraft(cookie);
    const sh1 = await shownHash(id1, cookie);
    await makeDraft(cookie); // writes recipes/sources/locales for a SECOND recipe
    const res = await staleGrant(id1, cookie, sh1);
    expect(res.status).toBe(200);
    expect(await sealed(id1)).toBe(1);
  });

  it('post-submit grant is rejected by the revisions guard (grants are pre-submit only)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    // the permission page still RENDERS for a submitted recipe...
    const sh = await shownHash(id, cookie);
    // ...but its grant POST aborts at recipe_revisions_guard (submitted_at IS NULL required)
    const res = await staleGrant(id, cookie, sh);
    expect(res.status).toBe(409);
    expect(await sealed(id)).toBe(0);
  });

  it('post-submit owner edit is rejected at the app level (409 already sent)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    const res = await post('/account/recipes/save', {
      id, title: 'Late edit', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
      prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', category: 'soups-stews',
    }, { cookie });
    expect(res.status).toBe(409);
  });

  it('DOCUMENTED GAP: an admin edit on a submitted draft leaves the recipe stuck (no re-grant, no publish)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    expect((await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh.hash, shown_seq: sh.seq }, { cookie })).status).toBe(200);
    expect((await post(`/account/recipes/${id}/submit`, {}, { cookie })).status).toBe(200);
    // admin edits the submitted draft (in the queue, so MCP can see it)
    const edit = await toolCall(ADMIN_KEY, 'recipes.update_draft', { id, locales: [{ country: 'us', lang: 'en', title: 'Admin correction' }], confirmed: true });
    expect(edit.isError).toBe(false);
    // the live rows no longer match the consented head revision...
    // ...the owner cannot re-grant (submitted), even with a freshly displayed form
    const sh2 = await shownHash(id, cookie);
    expect((await staleGrant(id, cookie, sh2)).status).toBe(409);
    expect(await sealed(id)).toBe(1); // still only the pre-submit revision
    // ...and the admin cannot publish: the guard's canonical predicate fails
    const pub = await toolCall(ADMIN_KEY, 'recipes.publish', { id, confirmed: true });
    expect(pub.isError).toBe(true);
    expect((await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(id).first<{ status: string }>())!.status).toBe('draft');
    // recovery requires a design decision (design/0011 G9 options A/B) - no path exists today
  });

  it('structural inventory: the full guard + fence trigger set is intact', async () => {
    const rows = await DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name`).all<{ name: string }>();
    expect((rows.results ?? []).map((r) => r.name)).toEqual([
      'consent_fence_probe_check',
      'publish_assert',
      'publish_assert_scope',
      'publish_requests_consume_only',
      'publish_requests_insert_guard',
      'publish_requests_no_delete',
      'recipe_consent_events_guard',
      'recipe_consent_events_no_delete',
      'recipe_consent_events_no_update',
      'recipe_content_fence_bump_images_del',
      'recipe_content_fence_bump_images_ins',
      'recipe_content_fence_bump_images_replace',
      'recipe_content_fence_bump_images_upd',
      'recipe_content_fence_bump_locales_del',
      'recipe_content_fence_bump_locales_ins',
      'recipe_content_fence_bump_locales_replace',
      'recipe_content_fence_bump_locales_upd',
      'recipe_content_fence_bump_recipes_ins',
      'recipe_content_fence_bump_recipes_upd',
      'recipe_content_fence_bump_sources_ins',
      'recipe_content_fence_bump_sources_upd',
      'recipe_content_fence_reject_images_upd',
      'recipe_content_fence_reject_locales_upd',
      'recipe_content_fence_reject_recipes_upd',
      'recipe_content_fence_reject_sources_upd',
      'recipe_images_bound_no_delete',
      'recipe_images_bound_no_provenance_update',
      'recipe_images_bound_no_update',
      'recipe_images_insert_guard',
      'recipe_locales_insert_guard',
      'recipe_locales_no_content_mutation',
      'recipe_locales_no_delete_published',
      'recipe_locales_publish_guard',
      'recipe_revision_images_guard',
      'recipe_revision_images_no_delete',
      'recipe_revision_images_no_update',
      'recipe_revisions_guard',
      'recipe_revisions_no_delete',
      'recipe_revisions_no_update',
      'recipes_bound_fields_guard',
      'recipes_insert_guard',
      'sources_bound_fields_guard',
      'sources_insert_guard',
    ]);
  });
});
