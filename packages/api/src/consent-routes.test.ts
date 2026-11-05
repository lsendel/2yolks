// C2 permission-step routes (flag-gated; CONSENT_FLOW_ENABLED default off).
// Covers: 404 when off, 503 without the 0007 design tables, grant/withdraw
// binding an exact revision + license tuple, ownership, and i18n threading.
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { makeD1 } from './testd1';

type Sent = { to: string[]; subject: string; text: string };
let DB: D1Database;
let sent: Sent[];
const ORIGIN = 'https://2yolks.com';
const realFetch = globalThis.fetch;
const ON = { CONSENT_FLOW_ENABLED: 'true' };

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

function buildDB(applyDesign: boolean): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  // The REV 9 design SQL on top of all migrations (test-only, NOT a live DB apply).
  if (applyDesign) sqlite.exec(readFileSync(new URL('../../../design/0007-consent-revisions.sql', import.meta.url), 'utf8'));
  return makeD1(sqlite);
}

beforeEach(() => {
  DB = buildDB(true);
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
    const res = await get(`/account/recipes/${id}/permission`, cookie);
    expect(res.status).toBe(404);
  });

  it('answers 503 when the flag is on but the 0007 tables are absent', async () => {
    DB = buildDB(false);
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const res = await get(`/account/recipes/${id}/permission`, cookie, ON);
    expect(res.status).toBe(503);
  });

  it('shows the unchecked grant box and license line, then grants bound to an exact revision', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    const form = await get(`/account/recipes/${id}/permission`, cookie, ON);
    expect(form.status).toBe(200);
    const html = await form.text();
    expect(html).toContain('name="grant"');
    expect(html).not.toMatch(/name="grant"[^>]*checked/);
    expect(html).toContain('public-v1');
    expect(html).toContain('No permission recorded yet.');

    const noTick = await post(`/account/recipes/${id}/permission`, {}, { cookie, e: ON });
    expect(noTick.status).toBe(400);

    const ok = await post(`/account/recipes/${id}/permission?lang=es`, { grant: '1' }, { cookie, e: ON });
    expect(ok.status).toBe(200);
    const rev = await DB.prepare(`SELECT id, seq, content_hash FROM recipe_revisions WHERE recipe_id = ?`).bind(id).first<{ id: string; seq: number; content_hash: string }>();
    expect(rev!.seq).toBe(1);
    expect(rev!.content_hash).toMatch(/^[0-9a-f]{64}$/);
    const ev = await DB.prepare(`SELECT event, revision_id, license_version, license_lang, audience FROM recipe_consent_events WHERE recipe_id = ?`).bind(id).first<{ event: string; revision_id: string; license_version: string; license_lang: string; audience: string }>();
    expect(ev).toMatchObject({ event: 'grant', revision_id: rev!.id, license_version: 'public-v1', license_lang: 'es', audience: 'public' });

    const after = await get(`/account/recipes/${id}/permission`, cookie, ON);
    const html2 = await after.text();
    expect(html2).toContain('Permission is on for license public-v1');
    expect(html2).toContain('Withdraw permission');
    expect(html2).not.toContain('name="grant"');
  });

  it('withdraws against the granted revision and refuses a second withdraw', async () => {
    const cookie = await signIn('cook@example.com');
    const id = await makeDraft(cookie);
    await post(`/account/recipes/${id}/permission`, { grant: '1' }, { cookie, e: ON });
    const w = await post(`/account/recipes/${id}/permission/withdraw`, {}, { cookie, e: ON });
    expect(w.status).toBe(200);
    const rows = await DB.prepare(`SELECT event, revision_id FROM recipe_consent_events WHERE recipe_id = ? ORDER BY consent_seq`).bind(id).all<{ event: string; revision_id: string }>();
    expect(rows.results!.map((r) => r.event)).toEqual(['grant', 'revoke']);
    expect(rows.results![1]!.revision_id).toBe(rows.results![0]!.revision_id);
    const again = await post(`/account/recipes/${id}/permission/withdraw`, {}, { cookie, e: ON });
    expect(again.status).toBe(409);
  });

  it('hides another user\'s draft (404)', async () => {
    const owner = await signIn('cook@example.com');
    const id = await makeDraft(owner);
    const other = await signIn('other@example.com');
    const res = await get(`/account/recipes/${id}/permission`, other, ON);
    expect(res.status).toBe(404);
    const p = await post(`/account/recipes/${id}/permission`, { grant: '1' }, { cookie: other, e: ON });
    expect(p.status).toBe(404);
  });
});
