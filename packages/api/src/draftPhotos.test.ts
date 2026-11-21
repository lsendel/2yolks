// Tests for contributor dish cover photos (S5, migration 0012):
// client script compilation/guarding, multipart upload on create/edit/replace/delete,
// owner-only private serving with nosniff/no-store headers, SVG/bad-byte/oversize/quota
// rejection, draft deletion cleanup, and admin MCP photo inspection & moderation.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_PHOTO_CLIENT_SCRIPT } from '@2yolks/web/server';
import app from './index';
import { migratedD1All } from './testd1';

const ORIGIN = 'https://2yolks.com';
const ADMIN_KEY = 'test-admin-key-0000000000';
const EDITOR_KEY = 'test-editor-key-000000000';
const READ_KEY = 'test-read-key-00000000000';

// Minimal valid 1x1 PNG (68 bytes, verified CRC + scanline).
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
      return {
        body: new Response(o.bytes.slice().buffer as ArrayBuffer).body,
        httpMetadata: { contentType: o.contentType },
      };
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        objects.delete(k);
      }
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

function lastCode(): string {
  const text = sent[sent.length - 1]?.text ?? '';
  const m = text.match(/(\d{6})/);
  if (!m) throw new Error(`no 6-digit code in mail: ${text}`);
  return m[1]!;
}

async function signIn(email = 'cook@example.com'): Promise<string> {
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
  const code = lastCode();
  const r2 = await app.request(
    `${ORIGIN}/account/verify`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, code }).toString(),
    },
    env(),
  );
  expect(r2.status).toBe(303);
  const setCookie = r2.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0] ?? '';
  expect(cookie).toContain('__Host-2y_sid=');
  return cookie;
}

function recipeFormData(overrides: Record<string, string | File | undefined> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    category: 'soups-stews',
    title: 'Caldo Verde',
    locale: 'us:en',
    intro: 'Simple potato and greens soup.',
    ingredients: '2 tbsp olive oil\n500 g potatoes\n150 g collard greens',
    steps: 'Simmer potatoes 15 min.\nShred greens and cook 5 min.',
    display_name: 'Maria',
    source_kind: 'original',
    attest: '1',
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) fd.delete(k);
    else fd.set(k, v);
  }
  return fd;
}

async function toolCall(token: string, name: string, args: Record<string, unknown>) {
  const res = await app.request(
    `${ORIGIN}/api/admin/mcp`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    },
    env(),
  );
  const body = (await res.json()) as {
    result?: { content?: { text: string }[]; isError?: boolean };
    error?: { code: number; message: string };
  };
  const text = body.result?.content?.[0]?.text;
  return {
    status: res.status,
    rpcError: body.error,
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
  vi.restoreAllMocks();
});

describe('S5 client script', () => {
  it('compiles cleanly and exits safely in minimal/no-DOM environments', () => {
    const fn = new Function(DRAFT_PHOTO_CLIENT_SCRIPT);
    expect(() => fn()).not.toThrow();

    // Minimal fake document with a photo field and no window/FileReader/DataTransfer.
    const listeners: Record<string, () => void> = {};
    const fakeWrap = {
      getAttribute: () => '',
      querySelector: (sel: string) => {
        if (sel === '[data-draft-photo-input]') {
          return {
            files: [],
            addEventListener: (ev: string, cb: () => void) => {
              listeners[`input:${ev}`] = cb;
            },
          };
        }
        if (sel === '[data-draft-photo-remove]') {
          return {
            hidden: true,
            addEventListener: (ev: string, cb: () => void) => {
              listeners[`remove:${ev}`] = cb;
            },
          };
        }
        return { hidden: true, value: '', src: '', textContent: '', getAttribute: () => 'Resizing...', removeAttribute: () => {} };
      },
    };
    const origDoc = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { querySelector: () => fakeWrap };
    try {
      expect(() => new Function(DRAFT_PHOTO_CLIENT_SCRIPT)()).not.toThrow();
      expect(() => listeners['input:change']?.()).not.toThrow();
      expect(() => listeners['remove:click']?.()).not.toThrow();
    } finally {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  });
});

describe('S5 contributor draft cover photos', () => {
  it('saves a valid photo privately on recipe creation and serves it owner-only', async () => {
    const cookie = await signIn('owner@example.com');
    const fd = recipeFormData({
      dish_photo: new File([pngBytes()], 'caldo.png', { type: 'image/png' }),
    });
    const save = await app.request(
      `${ORIGIN}/account/recipes/save`,
      { method: 'POST', headers: { origin: ORIGIN, cookie }, body: fd },
      env(),
    );
    expect(save.status).toBe(303);
    const loc = save.headers.get('location') ?? '';
    const m = loc.match(/\/account\/recipes\/([^/]+)\/edit/);
    expect(m).toBeTruthy();
    const recipeId = m![1]!;

    const dp = await DB.prepare(
      'SELECT id, recipe_id, user_id, r2_key, mime, bytes, width, height, status, image_id FROM draft_photos WHERE recipe_id = ?',
    )
      .bind(recipeId)
      .first<{
        id: string;
        recipe_id: string;
        user_id: string;
        r2_key: string;
        mime: string;
        bytes: number;
        width: number;
        height: number;
        status: string;
        image_id: string | null;
      }>();
    expect(dp).toBeTruthy();
    expect(dp!.status).toBe('pending');
    expect(dp!.mime).toBe('image/png');
    expect(dp!.width).toBe(1);
    expect(dp!.height).toBe(1);
    expect(dp!.image_id).toBeNull();
    expect(dp!.r2_key).toMatch(new RegExp(`^drafts/${dp!.user_id}/${recipeId}/[a-z0-9]+\\.png$`));
    expect(R2.objects.has(dp!.r2_key)).toBe(true);

    // Never auto-writes public recipe_images.
    const pubImgs = await DB.prepare('SELECT count(*) AS n FROM recipe_images').first<{ n: number }>();
    expect(pubImgs?.n).toBe(0);

    // Edit page shows the owner-only preview URL.
    const editRes = await app.request(`${ORIGIN}/account/recipes/${recipeId}/edit`, { headers: { cookie } }, env());
    expect(editRes.status).toBe(200);
    const editHtml = await editRes.text();
    expect(editHtml).toContain(`src="/account/recipes/${recipeId}/photo"`);

    // Owner read succeeds with strict privacy headers.
    const ownPhoto = await app.request(`${ORIGIN}/account/recipes/${recipeId}/photo`, { headers: { cookie } }, env());
    expect(ownPhoto.status).toBe(200);
    expect(ownPhoto.headers.get('content-type')).toBe('image/png');
    expect(ownPhoto.headers.get('cache-control')).toBe('private, no-store');
    expect(ownPhoto.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await ownPhoto.arrayBuffer())).toEqual(pngBytes());

    // Unauthenticated request is blocked/redirected.
    const anonPhoto = await app.request(`${ORIGIN}/account/recipes/${recipeId}/photo`, {}, env());
    expect(anonPhoto.status).toBe(303);
    expect(anonPhoto.headers.get('location')).toContain('/account?next=');

    // Different signed-in user gets 404.
    const otherCookie = await signIn('other@example.com');
    const otherPhoto = await app.request(
      `${ORIGIN}/account/recipes/${recipeId}/photo`,
      { headers: { cookie: otherCookie } },
      env(),
    );
    expect(otherPhoto.status).toBe(404);
  });

  it('supports replacing and deleting draft photos on edit, direct photo endpoints, and draft deletion cleanup', async () => {
    const cookie = await signIn('editor@example.com');
    const save1 = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ dish_photo: new File([pngBytes()], 'one.png', { type: 'image/png' }) }),
      },
      env(),
    );
    const recipeId = (save1.headers.get('location') ?? '').match(/\/account\/recipes\/([^/]+)\/edit/)![1]!;
    const firstKey = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ r2_key: string }>())!.r2_key;
    expect(R2.objects.has(firstKey)).toBe(true);

    // Replace via /recipes/save removes the old R2 object.
    const save2 = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ id: recipeId, dish_photo: new File([pngBytes()], 'two.png', { type: 'image/png' }) }),
      },
      env(),
    );
    expect(save2.status).toBe(303);
    const secondKey = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ r2_key: string }>())!.r2_key;
    expect(secondKey).not.toBe(firstKey);
    expect(R2.objects.has(firstKey)).toBe(false);
    expect(R2.objects.has(secondKey)).toBe(true);

    // Remove via remove_photo=1 on /recipes/save deletes the pending row & R2 object.
    const save3 = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ id: recipeId, remove_photo: '1' }),
      },
      env(),
    );
    expect(save3.status).toBe(303);
    expect(R2.objects.has(secondKey)).toBe(false);
    expect((await DB.prepare('SELECT count(*) AS n FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ n: number }>())?.n).toBe(0);

    // Direct JSON upload endpoint + JSON delete endpoint.
    const upFd = new FormData();
    upFd.set('dish_photo', new File([pngBytes()], 'direct.png', { type: 'image/png' }));
    const upJson = await app.request(
      `${ORIGIN}/account/recipes/${recipeId}/photo`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, accept: 'application/json' }, body: upFd },
      env(),
    );
    expect(upJson.status).toBe(200);
    const upData = (await upJson.json()) as { ok: boolean; photoUrl: string; bytes: number };
    expect(upData.ok).toBe(true);
    expect(upData.photoUrl).toBe(`/account/recipes/${recipeId}/photo`);
    const directKey = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ r2_key: string }>())!.r2_key;
    expect(R2.objects.has(directKey)).toBe(true);

    const delJson = await app.request(
      `${ORIGIN}/account/recipes/${recipeId}/photo/delete`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, accept: 'application/json' } },
      env(),
    );
    expect(delJson.status).toBe(200);
    expect(((await delJson.json()) as { ok: boolean }).ok).toBe(true);
    expect(R2.objects.has(directKey)).toBe(false);

    // Redirect mode on direct upload, followed by draft deletion cleaning R2.
    const upRedirFd = new FormData();
    upRedirFd.set('dish_photo', new File([pngBytes()], 'redir.png', { type: 'image/png' }));
    const upRedir = await app.request(
      `${ORIGIN}/account/recipes/${recipeId}/photo`,
      { method: 'POST', headers: { origin: ORIGIN, cookie }, body: upRedirFd },
      env(),
    );
    expect(upRedir.status).toBe(303);
    const keyBeforeDelete = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ r2_key: string }>())!.r2_key;
    expect(R2.objects.has(keyBeforeDelete)).toBe(true);

    const delDraft = await app.request(
      `${ORIGIN}/account/recipes/${recipeId}/delete`,
      { method: 'POST', headers: { origin: ORIGIN, cookie } },
      env(),
    );
    expect(delDraft.status).toBe(303);
    expect(R2.objects.has(keyBeforeDelete)).toBe(false);
    expect((await DB.prepare('SELECT count(*) AS n FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ n: number }>())?.n).toBe(0);
  });

  it('rejects SVG, HTML, oversize, and quota-exceeding photos while preserving typed form and existing photo', async () => {
    const cookie = await signIn('guard@example.com');
    // Seed a valid draft photo first.
    const createRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ title: 'Sopa Seca', dish_photo: new File([pngBytes()], 'good.png', { type: 'image/png' }) }),
      },
      env(),
    );
    const recipeId = (createRes.headers.get('location') ?? '').match(/\/account\/recipes\/([^/]+)\/edit/)![1]!;
    const existingKey = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(recipeId).first<{ r2_key: string }>())!.r2_key;

    // 1. SVG payload rejected, preserves typed title and existing valid photo.
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'evil.svg', { type: 'image/svg+xml' });
    const badRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ id: recipeId, title: 'My Typed Soup', dish_photo: svg }),
      },
      env(),
    );
    expect(badRes.status).toBe(400);
    const badHtml = await badRes.text();
    expect(badHtml).toContain('value="My Typed Soup"');
    expect(badHtml).toContain('id="err-dish_photo"');
    expect(badHtml).toContain(`src="/account/recipes/${recipeId}/photo"`);
    expect(R2.objects.has(existingKey)).toBe(true);

    // 2. Oversize (> 3 MB) rejected.
    const bigBytes = new Uint8Array(3 * 1024 * 1024 + 512);
    const bigRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ id: recipeId, title: 'Big Soup', dish_photo: new File([bigBytes], 'big.png', { type: 'image/png' }) }),
      },
      env(),
    );
    expect(bigRes.status).toBe(400);
    const bigHtml = await bigRes.text();
    expect(bigHtml).toContain('id="err-dish_photo"');
    expect(bigHtml).toContain('value="Big Soup"');

    // 3. Per-user pending quota (25 MB) enforced.
    const uid = (await DB.prepare('SELECT id FROM users WHERE email = ?').bind('guard@example.com').first<{ id: string }>())!.id;
    await DB.prepare("INSERT INTO sources (id, name, url, license) VALUES ('qs1', 'n', 'https://x.example', 'user-original')").run();
    await DB.prepare("INSERT INTO recipes (id, source_id, created_at, owner_user_id) VALUES ('qr1', 'qs1', '2026-10-01', ?)").bind(uid).run();
    await DB.prepare(
      "INSERT INTO draft_photos (id, recipe_id, user_id, r2_key, mime, bytes, width, height, status, created_at) VALUES ('qp1', 'qr1', ?, 'drafts/x', 'image/jpeg', ?, 100, 100, 'pending', '2026-10-01')",
    )
      .bind(uid, 25 * 1024 * 1024)
      .run();
    const quotaRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ dish_photo: new File([pngBytes()], 'over.png', { type: 'image/png' }) }),
      },
      env(),
    );
    expect(quotaRes.status).toBe(400);
    expect(await quotaRes.text()).toContain('id="err-dish_photo"');
  });

  it('gates MCP inspection/moderation on admin & submission, never auto-publishes, and supports approve, reject, and publish+approvePhoto', async () => {
    const cookie = await signIn('chef@example.com');

    // Create Draft A with cover photo (not yet submitted).
    const resA = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ title: 'Draft A Soup', dish_photo: new File([pngBytes()], 'a.png', { type: 'image/png' }) }),
      },
      env(),
    );
    const idA = (resA.headers.get('location') ?? '').match(/\/account\/recipes\/([^/]+)\/edit/)![1]!;

    // Unsubmitted draft: admin MCP get_draft_photo & moderate_draft_photo must fail/hide.
    const unsubGet = await toolCall(ADMIN_KEY, 'recipes.get_draft_photo', { id: idA });
    expect(unsubGet.isError).toBe(true);
    const unsubMod = await toolCall(ADMIN_KEY, 'recipes.moderate_draft_photo', { id: idA, decision: 'approve', confirmed: true });
    expect(unsubMod.isError).toBe(true);

    // Submit Draft A for review.
    const subA = await app.request(
      `${ORIGIN}/account/recipes/${idA}/submit`,
      { method: 'POST', headers: { origin: ORIGIN, cookie } },
      env(),
    );
    expect(subA.status).toBe(200);

    // Submitted draft: direct photo mutation by author now conflicts (409).
    const postLocked = await app.request(
      `${ORIGIN}/account/recipes/${idA}/photo/delete`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, accept: 'application/json' } },
      env(),
    );
    expect(postLocked.status).toBe(409);

    // Non-admin keys are denied.
    expect((await toolCall(READ_KEY, 'recipes.get_draft_photo', { id: idA })).isError).toBe(true);
    expect((await toolCall(EDITOR_KEY, 'recipes.get_draft_photo', { id: idA })).isError).toBe(true);
    expect((await toolCall(EDITOR_KEY, 'recipes.moderate_draft_photo', { id: idA, decision: 'approve', confirmed: true })).isError).toBe(true);

    // Admin list & get surface draft photo indicators and metadata.
    const listRes = await toolCall(ADMIN_KEY, 'recipes.list', { submitted: true });
    expect(listRes.isError).toBe(false);
    const listedA = (listRes.data!['recipes'] as Record<string, unknown>[]).find((r) => r['id'] === idA);
    expect(listedA?.['has_draft_photo']).toBe(1);

    const getRes = await toolCall(ADMIN_KEY, 'recipes.get', { id: idA });
    expect(getRes.isError).toBe(false);
    expect((getRes.data!['draft_photo'] as Record<string, unknown>)['status']).toBe('pending');
    const sourceIdA = (getRes.data!['source'] as Record<string, unknown>)['id'] as string;

    // Admin get_draft_photo returns exact base64 image + metadata.
    const fetchPhoto = await toolCall(ADMIN_KEY, 'recipes.get_draft_photo', { id: idA });
    expect(fetchPhoto.isError).toBe(false);
    expect(fetchPhoto.data!['image_base64']).toBe(PNG_1X1_B64);
    expect(fetchPhoto.data!['mime']).toBe('image/png');
    expect(fetchPhoto.data!['width']).toBe(1);

    // Admin clears source and publishes Draft A WITHOUT approvePhoto: photo must stay un-published!
    expect((await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: sourceIdA, notes: 'Original cook submission', confirmed: true })).isError).toBe(false);
    const pubWithoutPhoto = await toolCall(ADMIN_KEY, 'recipes.publish', { id: idA, confirmed: true });
    expect(pubWithoutPhoto.isError).toBe(false);
    expect(pubWithoutPhoto.data!['pending_draft_photo']).toBe(true);
    expect((await DB.prepare('SELECT count(*) AS n FROM recipe_images WHERE recipe_id = ?').bind(idA).first<{ n: number }>())?.n).toBe(0);
    expect((await DB.prepare('SELECT image_key FROM recipes WHERE id = ?').bind(idA).first<{ image_key: string | null }>())?.image_key).toBeNull();

    // Dry-run moderation leaves DB and private R2 intact.
    const keyA = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(idA).first<{ r2_key: string }>())!.r2_key;
    const dryMod = await toolCall(ADMIN_KEY, 'recipes.moderate_draft_photo', { id: idA, decision: 'approve' });
    expect(dryMod.isError).toBe(false);
    expect(dryMod.data!['dry_run']).toBe(true);
    expect(R2.objects.has(keyA)).toBe(true);

    // Confirmed approve copies to public recipe_images (style='photo'), updates recipes.image_key, deletes private R2 key.
    const appMod = await toolCall(ADMIN_KEY, 'recipes.moderate_draft_photo', { id: idA, decision: 'approve', confirmed: true });
    expect(appMod.isError).toBe(false);
    expect(appMod.data!['status']).toBe('approved');
    const imageIdA = appMod.data!['image_id'] as string;
    expect(R2.objects.has(keyA)).toBe(false);
    const pubImg = await DB.prepare('SELECT r2_key, style, source_name, cleared_at FROM recipe_images WHERE id = ?')
      .bind(imageIdA)
      .first<{ r2_key: string; style: string; source_name: string; cleared_at: string | null }>();
    expect(pubImg?.style).toBe('photo');
    expect(pubImg?.source_name).toBe('Maria');
    expect(pubImg?.cleared_at).toBeTruthy();
    expect(R2.objects.has(pubImg!.r2_key)).toBe(true);
    expect((await DB.prepare('SELECT image_key FROM recipes WHERE id = ?').bind(idA).first<{ image_key: string | null }>())?.image_key).toBe(pubImg!.r2_key);

    // Public image endpoint now serves it!
    const publicImgRes = await app.request(`${ORIGIN}/img/recipe/${imageIdA}`, {}, env());
    expect(publicImgRes.status).toBe(200);
    expect(new Uint8Array(await publicImgRes.arrayBuffer())).toEqual(pngBytes());

    // Create & submit Draft B, then reject its cover photo.
    const resB = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ title: 'Draft B Stew', intent: 'submit', dish_photo: new File([pngBytes()], 'b.png', { type: 'image/png' }) }),
      },
      env(),
    );
    expect(resB.status).toBe(200);
    const idB = (await DB.prepare("SELECT id FROM recipes WHERE id <> ? ORDER BY created_at DESC LIMIT 1").bind(idA).first<{ id: string }>())!.id;
    const keyB = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(idB).first<{ r2_key: string }>())!.r2_key;
    const rejMod = await toolCall(ADMIN_KEY, 'recipes.moderate_draft_photo', { id: idB, decision: 'reject', confirmed: true });
    expect(rejMod.isError).toBe(false);
    expect(rejMod.data!['status']).toBe('rejected');
    expect(R2.objects.has(keyB)).toBe(false);
    expect((await DB.prepare('SELECT status FROM draft_photos WHERE recipe_id = ?').bind(idB).first<{ status: string }>())?.status).toBe('rejected');
    expect((await DB.prepare('SELECT count(*) AS n FROM recipe_images WHERE recipe_id = ?').bind(idB).first<{ n: number }>())?.n).toBe(0);

    // Create & submit Draft C, then publish with approvePhoto: true.
    await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie },
        body: recipeFormData({ title: 'Draft C Broth', intent: 'submit', dish_photo: new File([pngBytes()], 'c.png', { type: 'image/png' }) }),
      },
      env(),
    );
    const rowC = await DB.prepare("SELECT id, source_id FROM recipes WHERE id NOT IN (?, ?) LIMIT 1").bind(idA, idB).first<{ id: string; source_id: string }>();
    const keyC = (await DB.prepare('SELECT r2_key FROM draft_photos WHERE recipe_id = ?').bind(rowC!.id).first<{ r2_key: string }>())!.r2_key;
    expect((await toolCall(ADMIN_KEY, 'sources.clear_rights', { id: rowC!.source_id, notes: 'Original cook submission', confirmed: true })).isError).toBe(false);
    const pubWithPhoto = await toolCall(ADMIN_KEY, 'recipes.publish', { id: rowC!.id, approvePhoto: true, confirmed: true });
    expect(pubWithPhoto.isError).toBe(false);
    const imgIdC = pubWithPhoto.data!['approved_photo_image_id'] as string;
    expect(imgIdC).toBeTruthy();
    expect(R2.objects.has(keyC)).toBe(false);
    expect((await DB.prepare('SELECT image_key FROM recipes WHERE id = ?').bind(rowC!.id).first<{ image_key: string | null }>())?.image_key).toBeTruthy();
  });
});
