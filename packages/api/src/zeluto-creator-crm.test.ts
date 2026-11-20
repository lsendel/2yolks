import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { safeNextPath } from './account';
import app from './index';
import { migratedD1All } from './testd1';

type Sent = { to: string[]; subject: string; text: string };
const ORIGIN = 'https://2yolks.com';
const origFetch = globalThis.fetch;

let DB: D1Database;
let sent: Sent[];
let approvalState: 'pending_approval' | 'approved';

function testEnv(extra: Record<string, unknown> = {}) {
  return {
    DB,
    CANONICAL_ORIGIN: ORIGIN,
    ALLOW_DEMO_SEED: 'false',
    IMPORT_ENABLED: 'true',
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    RESEND_API_KEY: 're_test',
    REVIEW_NOTIFY_TO: 'owner@example.com',
    ADMIN_MCP_API_KEY: 'mcp-admin-secret',
    ZELUTO_URL: 'https://zeluto.com',
    ZELUTO_CLIENT_SECRET: 'zel-2yolks-master',
    ZELUTO_SYNC_SECRET: '2yolks-sync-sec',
    ZELUTO_BRAND_ORG_ID: 'z-brand-2yolks',
    ...extra,
  };
}

function post(
  path: string,
  form: Record<string, string>,
  opts: { cookie?: string; acceptJson?: boolean } = {},
) {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    origin: ORIGIN,
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.acceptJson) headers.accept = 'application/json';
  return app.request(
    `${ORIGIN}${path}`,
    { method: 'POST', headers, body: new URLSearchParams(form).toString() },
    testEnv(),
  );
}

function get(path: string, cookie?: string, headers: Record<string, string> = {}) {
  return app.request(
    `${ORIGIN}${path}`,
    { headers: { ...(cookie ? { cookie } : {}), ...headers } },
    testEnv(),
  );
}

async function signIn(email: string): Promise<string> {
  await post('/account/code', { email });
  const code = /code is (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;
  const res = await post('/account/verify', { email, code });
  expect(res.status).toBe(303);
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

beforeEach(() => {
  DB = migratedD1All();
  sent = [];
  approvalState = 'pending_approval';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"mail_1"}', { status: 200 });
    }
    if (url === 'https://zeluto.com/api/v1/ingest/contacts') {
      const hdrs = (init?.headers ?? {}) as Record<string, string>;
      const body = JSON.parse(String(init?.body ?? '{}')) as { externalId?: string };
      const zId = hdrs['X-Tenant-Id']
        ? `z-creator-sub-${body.externalId}`
        : `z-user-${body.externalId}`;
      return new Response(JSON.stringify({ status: 'created', zelutoId: zId }), { status: 201 });
    }
    if (url === 'https://zeluto.com/api/v1/ingest/registrations' && init?.method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { externalTenantId: string };
      return new Response(
        JSON.stringify({
          status: 'pending_approval',
          requestId: 'req-2y-1',
          externalTenantId: body.externalTenantId,
          zelutoOrganizationId: 'z-creator-99',
        }),
        { status: 202 },
      );
    }
    if (url.startsWith('https://zeluto.com/api/v1/ingest/registrations/creator%3A')) {
      return new Response(
        JSON.stringify({
          status: approvalState,
          requestId: 'req-2y-1',
          zelutoOrganizationId: approvalState === 'approved' ? 'z-creator-99' : null,
          emailSendReady: false,
        }),
        { status: 200 },
      );
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe('2yolks Unified User/Creator Zeluto CRM & Strict Subscriber Isolation', () => {
  it('allows deep-linking back to /account/subscribers across sign-in', () => {
    expect(safeNextPath('/account/subscribers')).toBe('/account/subscribers');
    expect(safeNextPath('/account')).toBe('/account');
    expect(safeNextPath('https://evil.com')).toBeNull();
  });

  it('redirects unauthenticated GET /account/subscribers directly via ?next= deep-link', async () => {
    const res = await get('/account/subscribers');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/account?next=%2Faccount%2Fsubscribers');
  });

  it('keeps users as subscribers until they share a recipe, gates Creator CRM behind Super-Admin approval, isolates creator_subscribers, and serves Dagster sync', async () => {
    // 1. User A & User B & User C start as unified users/subscribers
    const cookieA = await signIn('creator-a@example.com');
    const cookieB = await signIn('subscriber-b@example.com');
    const cookieC = await signIn('follower-c@example.com');

    const userA = (await DB.prepare('SELECT id, zeluto_contact_id FROM users WHERE email = ?')
      .bind('creator-a@example.com')
      .first<{ id: string; zeluto_contact_id: string | null }>())!;
    const userB = (await DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind('subscriber-b@example.com')
      .first<{ id: string }>())!;
    expect(userA.zeluto_contact_id).toBe(`z-user-${userA.id}`);

    // Before sharing any recipe, User A cannot register Creator CRM or view creator subscribers
    const preRegRes = await post('/account/zeluto/register', {}, { cookie: cookieA, acceptJson: true });
    expect(preRegRes.status).toBe(403);
    const preSubView = await get('/account/subscribers', cookieA, { accept: 'application/json' });
    expect(preSubView.status).toBe(403);
    const preFollow = await post(
      `/account/creators/${userA.id}/subscribe`,
      {},
      { cookie: cookieC, acceptJson: true },
    );
    expect(preFollow.status).toBe(403);

    // 2. User A saves & submits a recipe -> submitted_at is set -> User A becomes a Creator!
    await post(
      '/account/recipes/save',
      {
        title: 'Sunday Dumplings',
        locale: 'us:en',
        intro: 'Homemade dumplings.',
        ingredients: '2 cups flour\n1 cup water',
        steps: 'Mix dough.\nBoil.',
        prep: '15',
        cook: '10',
        servings: '4',
        display_name: 'Chef A',
        source_kind: 'original',
        source_url: '',
        attest: '1',
      },
      { cookie: cookieA },
    );
    const recipe = (await DB.prepare('SELECT id FROM recipes WHERE owner_user_id = ?')
      .bind(userA.id)
      .first<{ id: string }>())!;
    const submitRes = await post(`/account/recipes/${recipe.id}/submit`, {}, { cookie: cookieA });
    expect(submitRes.status).toBe(200);

    // Dashboard now unlocks Creator Subscribers link
    const homeHtml = await (await get('/account', cookieA)).text();
    expect(homeHtml).toContain('/account/subscribers');

    // 3. Creator A requests Zeluto workspace -> pending_approval
    const regRes = await post('/account/zeluto/register', {}, { cookie: cookieA, acceptJson: true });
    expect(regRes.status).toBe(202);
    const regJson = (await regRes.json()) as { status: string; subscribersUrl: string | null };
    expect(regJson.status).toBe('pending_approval');
    expect(regJson.subscribersUrl).toBeNull();

    // 4. Super-Admin approves in Zeluto -> Creator A gets direct deep-links + BYO-Resend warning
    approvalState = 'approved';
    const creatorViewRes = await get('/account/subscribers', cookieA, {
      accept: 'application/json',
    });
    expect(creatorViewRes.status).toBe(200);
    const creatorViewJson = (await creatorViewRes.json()) as {
      zelutoStatus: string;
      zelutoOrgId: string;
      emailSendReady: boolean;
      subscribersUrl: string;
      deliverySetupUrl: string;
    };
    expect(creatorViewJson.zelutoStatus).toBe('approved');
    expect(creatorViewJson.zelutoOrgId).toBe('z-creator-99');
    expect(creatorViewJson.emailSendReady).toBe(false);
    expect(creatorViewJson.subscribersUrl).toBe(
      'https://zeluto.com/app/w/z-creator-99/crm/contacts?stage=subscriber',
    );
    expect(creatorViewJson.deliverySetupUrl).toBe(
      'https://zeluto.com/app/w/z-creator-99/delivery/providers',
    );

    const creatorHtml = await (await get('/account/subscribers', cookieA)).text();
    expect(creatorHtml).toContain('Open My Subscribers in Zeluto');
    expect(creatorHtml).toContain('Configure Resend in Zeluto');

    // 5. User C follows Creator A (User B does NOT) -> strictly isolated creator_subscribers
    const followRes = await post(
      `/account/creators/${userA.id}/subscribe`,
      {},
      { cookie: cookieC, acceptJson: true },
    );
    expect(followRes.status).toBe(201);
    const followJson = (await followRes.json()) as {
      syncedToCreatorWorkspace: boolean;
      zelutoContactId: string;
    };
    expect(followJson.syncedToCreatorWorkspace).toBe(true);
    expect(followJson.zelutoContactId).toMatch(/^z-creator-sub-/);

    const creatorSubsAfter = (await (
      await get('/account/subscribers', cookieA, { accept: 'application/json' })
    ).json()) as { subscribers: Array<{ email: string }> };
    expect(creatorSubsAfter.subscribers.map((s) => s.email)).toEqual(['follower-c@example.com']);
    expect(creatorSubsAfter.subscribers.some((s) => s.email === 'subscriber-b@example.com')).toBe(
      false,
    );

    // 6. Super-Admin link endpoint & Dagster /api/internal/zeluto-sync/*
    const adminRes = await app.request(
      `${ORIGIN}/api/admin/zeluto`,
      { headers: { authorization: 'Bearer mcp-admin-secret' } },
      testEnv(),
    );
    expect(adminRes.status).toBe(200);
    expect(await adminRes.json()).toEqual({
      ok: true,
      brandWorkspaceUrl: 'https://zeluto.com/app/w/z-brand-2yolks/crm/contacts',
      platformAdminRegistrationsUrl: 'https://zeluto.com/app/platform-admin/registrations',
    });

    const syncHeaders = { authorization: 'Bearer 2yolks-sync-sec' };
    const tenantsRes = await app.request(
      `${ORIGIN}/api/internal/zeluto-sync/tenants`,
      { headers: syncHeaders },
      testEnv(),
    );
    expect(tenantsRes.status).toBe(200);
    expect(await tenantsRes.json()).toEqual({ tenants: [`creator:${userA.id}`] });

    const recordsRes = await app.request(
      `${ORIGIN}/api/internal/zeluto-sync/records`,
      { headers: syncHeaders },
      testEnv(),
    );
    expect(recordsRes.status).toBe(200);
    const { records } = (await recordsRes.json()) as {
      records: Array<{
        externalId: string;
        externalEntityType: string;
        email: string;
        externalTenantId: string | null;
        tenantApproved: boolean;
        isCreatorSharedRecipe: boolean;
      }>;
    };

    const userARec = records.find(
      (r) => r.externalEntityType === 'user' && r.email === 'creator-a@example.com',
    );
    expect(userARec?.isCreatorSharedRecipe).toBe(true);
    expect(userARec?.tenantApproved).toBe(true);
    expect(userARec?.externalTenantId).toBe(`creator:${userA.id}`);

    const userBRec = records.find(
      (r) => r.externalEntityType === 'user' && r.email === 'subscriber-b@example.com',
    );
    expect(userBRec?.isCreatorSharedRecipe).toBe(false);
    expect(userBRec?.externalTenantId).toBeNull();

    const subRec = records.find(
      (r) =>
        r.externalEntityType === 'creator_subscriber' && r.email === 'follower-c@example.com',
    );
    expect(subRec?.externalTenantId).toBe(`creator:${userA.id}`);
    expect(subRec?.tenantApproved).toBe(true);
    expect(subRec?.isCreatorSharedRecipe).toBe(true);

    // Creator-scoped suppression affects ONLY creator_subscribers, NOT site-wide users table
    const supRes = await app.request(
      `${ORIGIN}/api/internal/zeluto-sync/suppressions`,
      {
        method: 'POST',
        headers: { ...syncHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: `creator:${userA.id}`,
          suppressions: [{ email: 'follower-c@example.com', reason: 'unsubscribe' }],
        }),
      },
      testEnv(),
    );
    expect(supRes.status).toBe(200);
    expect(await supRes.json()).toEqual({ applied: 1 });

    const userCRow = await DB.prepare(
      'SELECT marketing_opt_in, unsubscribed_at FROM users WHERE email = ?',
    )
      .bind('follower-c@example.com')
      .first<{ marketing_opt_in: number; unsubscribed_at: string | null }>();
    expect(userCRow!.marketing_opt_in).toBe(1);
    expect(userCRow!.unsubscribed_at).toBeNull();

    const csRow = await DB.prepare(
      'SELECT unsubscribed_at FROM creator_subscribers WHERE id = ?',
    )
      .bind(subRec!.externalId)
      .first<{ unsubscribed_at: string | null }>();
    expect(csRow!.unsubscribed_at).toBeTruthy();

    void userB;
  });
});
