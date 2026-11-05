// C2 permission-step routes (flag-gated; CONSENT_FLOW_ENABLED default off).
// Text and image permissions are separately unchecked and separately
// versioned; grants bind the DISPLAYED content hash (optimistic concurrency);
// provenance+revision+manifest+consent land in one atomic batch. Withdrawal
// is UNMOUNTED while its policy wording is pending (404 even with the flag on).
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from './index';
import { makeD1 } from './testd1';
import { reserveMail } from './account';

type Sent = { to: string[]; subject: string; text: string };
let DB: D1Database;
let sent: Sent[];
const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;
const ON = { CONSENT_FLOW_ENABLED: 'true' };
const DIGEST = 'a'.repeat(64);

function env(extra: Record<string, unknown> = {}) {
  return { DB, CANONICAL_ORIGIN: ORIGIN, ALLOW_DEMO_SEED: 'false', IMPORT_ENABLED: 'false', ASSETS: { fetch: async () => new Response('', { status: 404 }) }, RESEND_API_KEY: 're_test', ...extra };
}
function post(path: string, form: Record<string, string>, opts: { cookie?: string; e?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN };
  if (opts.cookie) headers['cookie'] = opts.cookie;
  return app.request(`${ORIGIN}${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString() }, env(opts.e));
}
function get(path: string, cookie: string, e?: Record<string, unknown>) {
  return app.request(`${ORIGIN}${path}`, { headers: { cookie } }, env(e));
}
const lastCode = () => /code is (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;

async function signIn(email: string): Promise<string> {
  await post('/account/code', { email });
  const res = await post('/account/verify', { email, code: lastCode() });
  expect(res.status).toBe(303);
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

async function makeDraft(cookie: string): Promise<string> {
  const res = await post('/account/recipes/save', {
    title: 'Abuela Soup', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
    prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', category: 'soups-stews',
  }, { cookie });
  expect(res.status).toBe(303);
  const m = /\/account\/recipes\/([^/]+)\/edit/.exec(res.headers.get('location')!)!;
  return m[1]!;
}

async function addImage(recipeId: string, opts: { digest?: boolean } = {}) {
  await DB.prepare(`INSERT INTO recipe_images (id, recipe_id, kind, step_index, r2_key, mime, bytes, style, source_name, source_url, license, sha256)
    VALUES ('img-1', ?, 'hero', NULL, 'r2/img-1', 'image/jpeg', 12345, 'photo', 'Ana', 'https://2yolks.com/', 'proprietary', ?)`).bind(recipeId, opts.digest === false ? null : DIGEST).run();
}

/** The content hash the permission form currently displays. */
async function shownHash(id: string, cookie: string): Promise<string> {
  const html = await (await get(`/account/recipes/${id}/permission`, cookie, ON)).text();
  return /name="shown_hash" value="([0-9a-f]{64})"/.exec(html)![1]!;
}

function buildDB(schema: 'none' | '0007' | '0008'): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  // Design SQL is test-only preparation, NOT a live DB apply.
  if (schema !== 'none') sqlite.exec(readFileSync(new URL('../../../design/0007-consent-revisions.sql', import.meta.url), 'utf8'));
  if (schema === '0008') {
    sqlite.exec(readFileSync(new URL('../../../design/0008-consent-scope.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../../design/0009-image-provenance.sql', import.meta.url), 'utf8'));
  }
  return makeD1(sqlite);
}

beforeEach(() => {
  DB = buildDB('0008');
  sent = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') { sent.push(JSON.parse(String(init!.body))); return new Response('{"id":"x"}', { status: 200 }); }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

describe('C2 permission step routes (flag-gated)', () => {
  it('answers 404 when the flag is off', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await get(`/account/recipes/${id}/permission`, cookie)).status).toBe(404);
  });

  it('answers 503 without the design tables, and 503 with 0007 but without the scope column', async () => {
    DB = buildDB('none');
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    expect((await get(`/account/recipes/${id}/permission`, cookie, ON)).status).toBe(503);
    DB = buildDB('0007');
    const cookie2 = await signIn('cook@example.com');
    const id2 = await makeDraft(cookie2);
    expect((await get(`/account/recipes/${id2}/permission`, cookie2, ON)).status).toBe(503);
  });

  it('grants text permission bound to the DISPLAYED revision and emails the cook a receipt', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const form = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html = await form.text();
    expect(html).toContain('name="grant"');
    expect(html).not.toContain('name="grant_images"');
    expect(html).not.toMatch(/name="grant"[^>]*checked/);
    expect(html).toContain('public-v1');
    const sh = /name="shown_hash" value="([0-9a-f]{64})"/.exec(html)![1]!;

    expect((await post(`/account/recipes/${id}/permission`, { shown_hash: sh }, { cookie, e: ON })).status).toBe(400);
    const ok = await post(`/account/recipes/${id}/permission?lang=es`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    expect(ok.status).toBe(200);
    const rev = await DB.prepare(`SELECT id, seq, content_hash FROM recipe_revisions WHERE recipe_id = ?`).bind(id).first<{ id: string; seq: number; content_hash: string }>();
    expect(rev!.seq).toBe(1);
    expect(rev!.content_hash).toBe(sh); // the granted revision IS the displayed content
    const ev = await DB.prepare(`SELECT event, revision_id, license_version, license_lang, audience, scope FROM recipe_consent_events WHERE recipe_id = ?`).bind(id).first<Record<string, string>>();
    expect(ev).toMatchObject({ event: 'grant', revision_id: rev!.id, license_version: 'public-v1', license_lang: 'es', audience: 'public', scope: 'text' });
    const receipt = sent.find((m) => m.subject.includes('Abuela Soup'));
    expect(receipt).toBeTruthy();
    expect(receipt!.to).toEqual(['cook@example.com']);
    expect(receipt!.text).toContain(rev!.content_hash.slice(0, 12));
    const kinds = await DB.prepare(`SELECT kind FROM mail_log WHERE kind = 'receipt'`).all();
    expect(kinds.results).toHaveLength(1);

    const after = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html2 = await after.text();
    expect(html2).toContain('Permission is on for license public-v1');
    expect(html2).toContain(sh.slice(0, 12));
    expect(html2).not.toContain('name="grant"');
    expect(html2).not.toContain('Withdraw permission');
  });

  it('keeps image permission separately unchecked, sealed and separately recorded', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    await addImage(id);
    const form = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html = await form.text();
    expect(html).toContain('name="grant"');
    expect(html).toContain('name="grant_images"');
    expect(html).not.toMatch(/name="grant_images"[^>]*checked/);
    const sh = await shownHash(id, cookie);

    // images grant without provenance is refused, and NOTHING is written
    const noProv = await post(`/account/recipes/${id}/permission`, { grant_images: '1', shown_hash: sh }, { cookie, e: ON });
    expect(noProv.status).toBe(400);
    // 'other' provenance without whose-permission is refused, and NOTHING is written
    const noNote = await post(`/account/recipes/${id}/permission`, { grant_images: '1', shown_hash: sh, 'prov_img-1': 'other' }, { cookie, e: ON });
    expect(noNote.status).toBe(400);
    expect((await DB.prepare(`SELECT provenance p FROM recipe_images WHERE id = 'img-1'`).first<{ p: string | null }>())!.p).toBeNull();
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_revisions`).first<{ n: number }>())!.n).toBe(0);
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_consent_events`).first<{ n: number }>())!.n).toBe(0);

    // text only: no image event
    await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    let evs = await DB.prepare(`SELECT scope, event FROM recipe_consent_events WHERE recipe_id = ? ORDER BY consent_seq`).bind(id).all<{ scope: string; event: string }>();
    expect(evs.results!.map((r) => r.scope)).toEqual(['text']);

    // images afterwards, bound to a NEW revision (separately versioned)
    const sh2 = await shownHash(id, cookie);
    const ok = await post(`/account/recipes/${id}/permission`, { grant_images: '1', shown_hash: sh2, 'prov_img-1': 'own' }, { cookie, e: ON });
    expect(ok.status).toBe(200);
    evs = await DB.prepare(`SELECT scope, event FROM recipe_consent_events WHERE recipe_id = ? ORDER BY consent_seq`).bind(id).all<{ scope: string; event: string }>();
    expect(evs.results!.map((r) => r.scope)).toEqual(['text', 'images']);
    // sealed: real digest in the snapshot AND one manifest row carrying provenance
    const rev = await DB.prepare(`SELECT snapshot_json s FROM recipe_revisions WHERE recipe_id = ? ORDER BY seq DESC LIMIT 1`).bind(id).first<{ s: string }>();
    expect((JSON.parse(rev!.s) as { images: Array<{ sha256: string; provenance: string }> }).images[0]).toMatchObject({ sha256: DIGEST, provenance: 'own' });
    const man = await DB.prepare(`SELECT sha256, provenance FROM recipe_revision_images WHERE provenance IS NOT NULL`).first<{ sha256: string; provenance: string }>();
    expect(man).toEqual({ sha256: DIGEST, provenance: 'own' });
    // bound provenance is immutable on the live row
    await expect(DB.prepare(`UPDATE recipe_images SET provenance = 'other' WHERE id = 'img-1'`).run()).rejects.toThrow();
    const after = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html2 = await after.text();
    expect(html2).toContain('Image permission is on for license public-v1');
  });

  it('refuses an images grant while any image lacks a sealed digest', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    await addImage(id, { digest: false });
    const sh = await shownHash(id, cookie);
    const res = await post(`/account/recipes/${id}/permission`, { grant_images: '1', shown_hash: sh, 'prov_img-1': 'own' }, { cookie, e: ON });
    expect(res.status).toBe(400);
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_consent_events`).first<{ n: number }>())!.n).toBe(0);
  });

  it('conflicts instead of granting an unseen edit (displayed-content binding)', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    await DB.prepare(`UPDATE recipe_locales SET title = 'UNSEEN EDIT' WHERE recipe_id = ?`).bind(id).run();
    const res = await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    expect(res.status).toBe(409);
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_revisions`).first<{ n: number }>())!.n).toBe(0);
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_consent_events`).first<{ n: number }>())!.n).toBe(0);
  });

  it('stops sending receipts at the per-kind daily cap', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    await DB.prepare(`INSERT INTO mail_log (id, kind, created_at) SELECT 'x' || hex(randomblob(4)), 'receipt', ? FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8)`).bind(Date.now()).run();
    const before = sent.length;
    const sh = await shownHash(id, cookie);
    const ok = await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    expect(ok.status).toBe(200); // the grant still lands; only the email is skipped
    expect(sent.length).toBe(before);
  });

  it('enforces the combined 40/day budget across every mail kind', async () => {
    await DB.prepare(`INSERT INTO mail_log (id, kind, created_at) SELECT 'r' || value, 'receipt', ? FROM json_each('[1,2,3,4,5,6,7,8]')`).bind(Date.now()).run();
    for (let i = 0; i < 32; i++) expect(await reserveMail(DB, 'code', 32)).toBe(true);
    expect(await reserveMail(DB, 'notice', 8)).toBe(false); // 8 + 32 = 40 combined: the 41st is refused
    expect((await DB.prepare(`SELECT count(*) n FROM mail_log`).first<{ n: number }>())!.n).toBe(40);
  });

  it('display state is bound to the exact revision: edits and later image grants make prior text consent stale', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    await addImage(id);
    const sh = await shownHash(id, cookie);
    await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    const edit = await post(`/account/recipes/save`, {
      id,
      title: 'Abuela Soup v2', locale: 'us:en', intro: 'Warm.', ingredients: '2 cups stock\n1 onion', steps: 'Chop.\nSimmer.',
      prep: '10', cook: '30', servings: '4', display_name: 'Ana', source_kind: 'original', source_url: '', attest: '1', category: 'soups-stews',
    }, { cookie });
    expect([200, 303]).toContain(edit.status);
    const after = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html = await after.text();
    expect(html).toContain('covers that saved version only, not the current draft');
    // image consent recorded on a NEW revision must not make the old text consent cover it
    const sh2 = await shownHash(id, cookie);
    await post(`/account/recipes/${id}/permission`, { grant_images: '1', shown_hash: sh2, 'prov_img-1': 'own' }, { cookie, e: ON });
    const html2 = await (await get(`/account/recipes/${id}/permission`, cookie, ON)).text();
    expect(html2).toContain('covers that saved version only, not the current draft');
    expect(html2).toContain('name="grant"'); // text re-grant box offered again
  });

  it('withdrawal is unreachable even with the flag on', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const sh = await shownHash(id, cookie);
    await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie, e: ON });
    const res = await post(`/account/recipes/${id}/permission/withdraw`, {}, { cookie, e: ON });
    expect(res.status).toBe(404);
    const evs = await DB.prepare(`SELECT event FROM recipe_consent_events WHERE recipe_id = ?`).bind(id).all<{ event: string }>();
    expect(evs.results!.map((r) => r.event)).toEqual(['grant']);
  });

  it('hides another user\'s draft (404)', async () => {
    const owner = await signIn('cook@example.com');
    const id = await makeDraft(owner);
    const other = await signIn('other@example.com');
    expect((await get(`/account/recipes/${id}/permission`, other, ON)).status).toBe(404);
    const sh = await shownHash(id, owner);
    expect((await post(`/account/recipes/${id}/permission`, { grant: '1', shown_hash: sh }, { cookie: other, e: ON })).status).toBe(404);
  });
});
