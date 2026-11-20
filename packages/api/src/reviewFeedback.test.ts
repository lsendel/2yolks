// Tests for S8 review status timeline, reviewer feedback MCP tools,
// declined copy workflow, 0013 migration backfill, and budgeted author notices.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from './index';
import { makeD1, migratedD1All } from './testd1';

const ORIGIN = 'https://2yolks.com';
const ADMIN_KEY = 'test-admin-key-0000000000';
const EDITOR_KEY = 'test-editor-key-000000000';
const READ_KEY = 'test-read-key-00000000000';
const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function pngBytes(): Uint8Array<ArrayBuffer> {
  const bin = atob(PNG_1X1_B64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function makeR2() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    objects,
    async put(key: string, value: Uint8Array | ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value);
      objects.set(key, { bytes, contentType: opts?.httpMetadata?.contentType });
      return { key };
    },
    async get(key: string) {
      const o = objects.get(key);
      if (!o) return null;
      return { body: new Response(o.bytes.slice().buffer as ArrayBuffer).body, httpMetadata: { contentType: o.contentType } };
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
  };
}

let DB: D1Database;
let R2: ReturnType<typeof makeR2>;
const sent: { to: string[]; subject: string; text: string }[] = [];
const realFetch = globalThis.fetch;

function env(extra: Record<string, unknown> = {}) {
  return {
    DB,
    IMAGES: R2,
    SUBMISSIONS_ENABLED: 'true',
    CANONICAL_ORIGIN: ORIGIN,
    RESEND_API_KEY: 're_test',
    RESEND_FROM: '2yolks <no-reply@2yolks.com>',
    ADMIN_MCP_API_KEY: ADMIN_KEY,
    MCP_READ_KEY: READ_KEY,
    MCP_NAMED_KEYS: JSON.stringify([{ name: 'editor-1', key: EDITOR_KEY, role: 'editor' }]),
    ...extra,
  };
}

async function signIn(email = 'author@example.com'): Promise<string> {
  const r1 = await app.request(
    `${ORIGIN}/account/code`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email }).toString(),
    },
    env(),
  );
  expect(r1.status).toBe(200);
  const codeMatch = (sent[sent.length - 1]?.text ?? '').match(/(\d{6})/);
  if (!codeMatch) throw new Error('missing login code email');
  const r2 = await app.request(
    `${ORIGIN}/account/verify`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, code: codeMatch[1]! }).toString(),
    },
    env(),
  );
  expect(r2.status).toBe(303);
  return (r2.headers.get('set-cookie') ?? '').split(';')[0]!;
}

function formBody(overrides: Record<string, string> = {}): string {
  return new URLSearchParams({
    category: 'soups-stews',
    title: 'Pozole Verde',
    locale: 'us:en',
    intro: 'Herby hominy stew.',
    ingredients: '500 g pork shoulder\n400 g tomatillos\n800 g hominy',
    steps: 'Simmer pork 75 min.\nBlend green sauce and simmer 15 min.',
    display_name: 'Elena',
    source_kind: 'original',
    attest: '1',
    ...overrides,
  }).toString();
}

async function createRecipe(cookie: string, overrides: Record<string, string> = {}, lang = 'en'): Promise<string> {
  const q = lang === 'en' ? '' : `?lang=${lang}`;
  const res = await app.request(
    `${ORIGIN}/account/recipes/save${q}`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody(overrides),
    },
    env(),
  );
  if (overrides['intent'] === 'submit') {
    expect(res.status).toBe(200);
    const row = await DB.prepare('SELECT id FROM recipes ORDER BY created_at DESC LIMIT 1').first<{ id: string }>();
    return row!.id;
  }
  expect(res.status).toBe(303);
  return (res.headers.get('location') ?? '').match(/\/account\/recipes\/([^/]+)\/edit/)![1]!;
}

async function toolCall(token: string, name: string, args: Record<string, unknown>, envOverrides: Record<string, unknown> = {}) {
  const res = await app.request(
    `${ORIGIN}/api/admin/mcp`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    },
    env(envOverrides),
  );
  const body = (await res.json()) as {
    result?: { content?: { text: string }[]; isError?: boolean };
  };
  const text = body.result?.content?.[0]?.text;
  return {
    status: res.status,
    isError: body.result?.isError === true,
    data: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
  };
}

beforeEach(() => {
  DB = migratedD1All();
  R2 = makeR2();
  sent.length = 0;
  globalThis.fetch = (async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"ok"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('0013_review_feedback backfill', () => {
  it('classifies legacy user rows accurately and leaves MCP rows untouched', async () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const file of [
      '0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql',
      '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql', '0008_recipe_test_reports.sql',
      '0009_ai_capture_budget.sql', '0010_test_report_photos.sql', '0012_draft_photos.sql',
    ]) {
      sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
    const d1 = makeD1(sqlite);
    await d1.prepare("INSERT INTO users (id, email, created_at) VALUES ('u1', 'a@b.c', '2026-01-01')").run();
    await d1.prepare("INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('s1', 'A', 'https://a.example', 'CC0-1.0', '2026-01-01')").run();

    const rows = [
      ['u_removed', 'u1', null, 'rejected'],
      ['u_live', 'u1', '2026-01-02', 'published'],
      ['u_declined', 'u1', '2026-01-02', 'rejected'],
      ['u_review', 'u1', '2026-01-02', 'draft'],
      ['u_draft', 'u1', null, 'draft'],
      ['m_pub', null, null, 'published'],
    ] as const;
    for (const [id, owner, sub, status] of rows) {
      await d1.prepare('INSERT INTO recipes (id, source_id, created_at, owner_user_id, submitted_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, 's1', '2026-01-01', owner, sub).run();
      await d1.prepare("INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES (?, 'us', 'en', ?, ?, '[]', '[]', ?)")
        .bind(id, id, id, status).run();
    }

    sqlite.exec(readFileSync(new URL('../migrations/0013_review_feedback.sql', import.meta.url), 'utf8'));

    const q = async (id: string) =>
      d1.prepare('SELECT review_status, removed_by_user_at FROM recipes WHERE id = ?').bind(id).first<{ review_status: string | null; removed_by_user_at: string | null }>();

    const rem = await q('u_removed');
    expect(rem!.removed_by_user_at).toBeTruthy();
    expect(rem!.review_status).toBeNull();

    expect(await q('u_live')).toEqual({ review_status: 'published', removed_by_user_at: null });
    expect(await q('u_declined')).toEqual({ review_status: 'declined', removed_by_user_at: null });
    expect(await q('u_review')).toEqual({ review_status: 'in_review', removed_by_user_at: null });
    expect(await q('u_draft')).toEqual({ review_status: null, removed_by_user_at: null });
    expect(await q('m_pub')).toEqual({ review_status: null, removed_by_user_at: null });
  });
});

describe('S8 dashboard timeline, request_changes, decline, copy, and live notices', () => {
  it('renders timelines, notes, actions, hides user-removed drafts, and keeps declined recipes visible', async () => {
    const cookie = await signIn();
    const idDraft = await createRecipe(cookie, { title: 'My Draft' });
    const idRemoved = await createRecipe(cookie, { title: 'Removed Draft' });
    const idReview = await createRecipe(cookie, { title: 'In Queue', intent: 'submit' });
    const idChanges = await createRecipe(cookie, { title: 'Needs Edit', intent: 'submit' });
    const idDeclined = await createRecipe(cookie, { title: 'Declined Soup', intent: 'submit' });
    const idLive = await createRecipe(cookie, { title: 'Live Dish', intent: 'submit' });

    const mailCountBeforeRemove = sent.length;
    const rmRes = await app.request(
      `${ORIGIN}/account/recipes/${idRemoved}/delete`,
      { method: 'POST', headers: { origin: ORIGIN, cookie } },
      env(),
    );
    expect(rmRes.status).toBe(303);
    expect(sent.length).toBe(mailCountBeforeRemove); // user removal never sends email
    const rmRow = await DB.prepare('SELECT removed_by_user_at FROM recipes WHERE id = ?').bind(idRemoved).first<{ removed_by_user_at: string | null }>();
    expect(rmRow?.removed_by_user_at).toBeTruthy();

    expect((await toolCall(ADMIN_KEY, 'recipes.request_changes', { id: idChanges, note: 'Check oven <tag>', confirmed: true })).isError).toBe(false);
    expect((await toolCall(ADMIN_KEY, 'recipes.decline', { id: idDeclined, reason: 'Out of scope', confirmed: true })).isError).toBe(false);
    const liveGet = await toolCall(ADMIN_KEY, 'recipes.get', { id: idLive });
    const liveSrc = (liveGet.data!['source'] as Record<string, unknown>)['id'] as string;
    expect((await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: liveSrc, notes: 'ok', confirmed: true })).isError).toBe(false);
    expect((await toolCall(ADMIN_KEY, 'recipes.publish', { id: idLive, confirmed: true })).isError).toBe(false);

    const dash = await app.request(`${ORIGIN}/account`, { headers: { cookie } }, env());
    expect(dash.status).toBe(200);
    const html = await dash.text();
    expect(html).not.toContain('Removed Draft');
    expect(html).toContain('My Draft');
    expect(html).toContain(`/account/recipes/${idDraft}/edit`);
    expect(html).toContain('In Queue');
    expect(html).toContain('Editing is paused while a reviewer checks your recipe');
    expect(html).toContain('Needs Edit');
    expect(html).toContain('Check oven &lt;tag&gt;');
    expect(html).toContain('Edit and resend');
    expect(html).toContain('Declined Soup');
    expect(html).toContain('Out of scope');
    expect(html).toContain(`/account/recipes/${idDeclined}/copy`);
    expect(html).toContain('Live Dish');
    expect(html).toContain('View live recipe');
    expect((html.match(/class="status-timeline"/g) ?? []).length).toBe(5);
  });

  it('supports request_changes (localized notice, fresh attestation gate, resend) and blocks non-admin / unsubmitted calls', async () => {
    const cookie = await signIn('esauthor@example.com');
    const draftId = await createRecipe(cookie, { title: 'Caldo', intent: 'submit' }, 'es');

    // Non-admin & unsubmitted checks.
    expect((await toolCall(READ_KEY, 'recipes.request_changes', { id: draftId, note: 'x', confirmed: true })).isError).toBe(true);
    expect((await toolCall(EDITOR_KEY, 'recipes.decline', { id: draftId, reason: 'x', confirmed: true })).isError).toBe(true);
    const unsubId = await createRecipe(cookie, { title: 'Private Draft' }, 'es');
    expect((await toolCall(ADMIN_KEY, 'recipes.request_changes', { id: unsubId, note: 'x', confirmed: true })).isError).toBe(true);
    expect((await toolCall(ADMIN_KEY, 'recipes.decline', { id: unsubId, reason: 'x', confirmed: true })).isError).toBe(true);

    // Dry-run does not mutate DB or send notice.
    const sentBefore = sent.length;
    const dry = await toolCall(ADMIN_KEY, 'recipes.request_changes', { id: draftId, note: 'Add cook time' });
    expect(dry.isError).toBe(false);
    expect(dry.data!['dry_run']).toBe(true);
    expect(sent.length).toBe(sentBefore);

    // Confirmed request_changes sends Spanish email and clears submitted_at + attested_at.
    const reqChanges = await toolCall(ADMIN_KEY, 'recipes.request_changes', { id: draftId, note: 'Falta sal al final', confirmed: true });
    expect(reqChanges.isError).toBe(false);
    expect(reqChanges.data!['review_status']).toBe('needs_changes');
    expect(reqChanges.data!['review_notice']).toBe('sent');
    expect(sent.length).toBe(sentBefore + 1);
    const mail = sent[sent.length - 1]!;
    expect(mail.to).toEqual(['esauthor@example.com']);
    expect(mail.subject).toContain('por favor ajusta');
    expect(mail.text).toContain('Falta sal al final');
    expect(mail.text).toContain(`/account/recipes/${draftId}/edit?lang=es`);

    const row = await DB.prepare('SELECT submitted_at, attested_at, review_status, review_note, review_notice FROM recipes WHERE id = ?')
      .bind(draftId)
      .first<{ submitted_at: string | null; attested_at: string | null; review_status: string; review_note: string; review_notice: string }>();
    expect(row!.submitted_at).toBeNull();
    expect(row!.attested_at).toBeNull();
    expect(row!.review_status).toBe('needs_changes');
    expect(row!.review_notice).toBe('sent');

    // Edit page surfaces reviewer callout banner.
    const editRes = await app.request(`${ORIGIN}/account/recipes/${draftId}/edit?lang=es`, { headers: { cookie } }, env());
    expect(editRes.status).toBe(200);
    const editHtml = await editRes.text();
    expect(editHtml).toContain('Falta sal al final');
    expect(editHtml).toContain('Cambios solicitados en revisión');

    // Resend without re-ticking attest fails 409.
    const failSubmit = await app.request(
      `${ORIGIN}/account/recipes/${draftId}/submit?lang=es`,
      { method: 'POST', headers: { origin: ORIGIN, cookie } },
      env(),
    );
    expect(failSubmit.status).toBe(409);

    // Save + re-attest + resend in French updates notify_lang and returns recipe to in_review.
    const resend = await app.request(
      `${ORIGIN}/account/recipes/save?lang=fr`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: formBody({ id: draftId, title: 'Caldo Mejorado', intent: 'submit', attest: '1' }),
      },
      env(),
    );
    expect(resend.status).toBe(200);
    const after = await DB.prepare('SELECT submitted_at, review_status, notify_lang FROM recipes WHERE id = ?')
      .bind(draftId)
      .first<{ submitted_at: string | null; review_status: string; notify_lang: string }>();
    expect(after!.submitted_at).toBeTruthy();
    expect(after!.review_status).toBe('in_review');
    expect(after!.notify_lang).toBe('fr');
  });

  it('declines with photo cleanup, locks editing/submitting, and lets author make a copy without sending email', async () => {
    const cookie = await signIn('copy@example.com');
    const fd = new FormData();
    fd.set('category', 'soups-stews');
    fd.set('title', 'Declinable Soup');
    fd.set('locale', 'us:en');
    fd.set('ingredients', '1 cup broth\n1 potato');
    fd.set('steps', 'Boil 10 min.');
    fd.set('display_name', 'Alex');
    fd.set('source_kind', 'original');
    fd.set('attest', '1');
    fd.set('intent', 'submit');
    fd.set('dish_photo', new File([pngBytes()], 'soup.png', { type: 'image/png' }));
    const createRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      { method: 'POST', headers: { origin: ORIGIN, cookie }, body: fd },
      env(),
    );
    expect(createRes.status).toBe(200);
    const declinedId = (await DB.prepare('SELECT id FROM recipes ORDER BY created_at DESC LIMIT 1').first<{ id: string }>())!.id;
    const photoKey = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(declinedId).first<{ r2_key: string }>())!.r2_key;
    expect(R2.objects.has(photoKey)).toBe(true);

    const sentBeforeDecline = sent.length;
    const dec = await toolCall(ADMIN_KEY, 'recipes.decline', { id: declinedId, reason: 'Already covered in catalog', confirmed: true });
    expect(dec.isError).toBe(false);
    expect(dec.data!['review_status']).toBe('declined');
    expect(dec.data!['review_notice']).toBe('sent');
    expect(sent.length).toBe(sentBeforeDecline + 1);
    expect(sent[sent.length - 1]!.text).toContain('Already covered in catalog');
    expect(R2.objects.has(photoKey)).toBe(false);
    expect((await DB.prepare('SELECT status FROM draft_photos WHERE recipe_id = ?').bind(declinedId).first<{ status: string }>())?.status).toBe('rejected');

    // Declined recipe locks edit/save/submit/photo endpoints (409).
    const editLocked = await app.request(`${ORIGIN}/account/recipes/${declinedId}/edit`, { headers: { cookie } }, env());
    expect(editLocked.status).toBe(409);
    expect(await editLocked.text()).toContain(`/account/recipes/${declinedId}/copy`);
    expect((await app.request(`${ORIGIN}/account/recipes/${declinedId}/submit`, { method: 'POST', headers: { origin: ORIGIN, cookie } }, env())).status).toBe(409);
    expect((await app.request(`${ORIGIN}/account/recipes/${declinedId}/photo/delete`, { method: 'POST', headers: { origin: ORIGIN, cookie, accept: 'application/json' } }, env())).status).toBe(409);

    // Making a copy creates a fresh private draft, never emails, and clears review_status / attested_at.
    const sentBeforeCopy = sent.length;
    const copyRes = await app.request(
      `${ORIGIN}/account/recipes/${declinedId}/copy`,
      { method: 'POST', headers: { origin: ORIGIN, cookie } },
      env(),
    );
    expect(copyRes.status).toBe(303);
    expect(sent.length).toBe(sentBeforeCopy);
    const loc = copyRes.headers.get('location') ?? '';
    expect(loc).toContain('copied=1');
    const copyId = loc.match(/\/account\/recipes\/([^/]+)\/edit/)![1]!;
    expect(copyId).not.toBe(declinedId);

    const copyRow = await DB.prepare('SELECT submitted_at, attested_at, review_status, review_note FROM recipes WHERE id = ?')
      .bind(copyId)
      .first<{ submitted_at: string | null; attested_at: string | null; review_status: string | null; review_note: string | null }>();
    expect(copyRow).toEqual({ submitted_at: null, attested_at: null, review_status: null, review_note: null });

    const editCopy = await app.request(`${ORIGIN}${loc}`, { headers: { cookie } }, env());
    expect(editCopy.status).toBe(200);
    const editCopyHtml = await editCopy.text();
    expect(editCopyHtml).toContain('Copied into a fresh draft');
    expect(editCopyHtml).toContain('value="Declinable Soup"');
  });

  it('sends one live notice when publishing a user recipe, and degrades cleanly when mail budget is exhausted or unconfigured', async () => {
    const cookie = await signIn('fr@example.com');
    const pubId = await createRecipe(cookie, { title: 'Soupe Fr', intent: 'submit' }, 'fr');
    const pubGet = await toolCall(ADMIN_KEY, 'recipes.get', { id: pubId });
    const srcId = (pubGet.data!['source'] as Record<string, unknown>)['id'] as string;
    expect((await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: srcId, notes: 'ok', confirmed: true })).isError).toBe(false);

    const sentBeforePub = sent.length;
    const pub = await toolCall(ADMIN_KEY, 'recipes.publish', { id: pubId, confirmed: true });
    expect(pub.isError).toBe(false);
    expect(pub.data!['review_notice']).toBe('sent');
    expect(sent.length).toBe(sentBeforePub + 1);
    const mail = sent[sent.length - 1]!;
    expect(mail.subject).toContain('est en ligne');
    expect(mail.text).toContain('https://2yolks.com/us/recipes/');

    // Adding & publishing a second locale later does NOT send a duplicate live email.
    await DB.prepare(
      "INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES (?, 'es', 'es', 'Sopa Es', ?, '[]', '[]', 'draft')",
    )
      .bind(pubId, `sopa-${pubId}`)
      .run();
    const sentBeforeSecond = sent.length;
    const pubSecond = await toolCall(ADMIN_KEY, 'recipes.publish', { id: pubId, country: 'es', lang: 'es', confirmed: true });
    expect(pubSecond.isError).toBe(false);
    expect(sent.length).toBe(sentBeforeSecond);

    // Exhaust NOTICES_PER_DAY (8) and verify review writes still succeed with skipped_budget.
    const nowMs = Date.now();
    for (let i = 0; i < 8; i++) {
      await DB.prepare("INSERT INTO mail_log (id, kind, created_at) VALUES (?, 'notice', ?)").bind(`nl-${i}`, nowMs).run();
    }
    const idBudget = await createRecipe(cookie, { title: 'Over Budget Dish', intent: 'submit' });
    const sentBeforeBudget = sent.length;
    const budgetRes = await toolCall(ADMIN_KEY, 'recipes.request_changes', { id: idBudget, note: 'Check step 2', confirmed: true });
    expect(budgetRes.isError).toBe(false);
    expect(budgetRes.data!['review_status']).toBe('needs_changes');
    expect(budgetRes.data!['review_notice']).toBe('skipped_budget');
    expect(sent.length).toBe(sentBeforeBudget);

    // Unconfigured RESEND_API_KEY records skipped_no_mail without blocking review action.
    const idNoMail = await createRecipe(cookie, { title: 'No Mail Config', intent: 'submit' });
    const noMailRes = await toolCall(ADMIN_KEY, 'recipes.decline', { id: idNoMail, reason: 'Missing info', confirmed: true }, { RESEND_API_KEY: undefined });
    expect(noMailRes.isError).toBe(false);
    expect(noMailRes.data!['review_status']).toBe('declined');
    expect(noMailRes.data!['review_notice']).toBe('skipped_no_mail');
  });
});
