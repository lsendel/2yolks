import { Hono } from 'hono';

export type ZelutoConnectionStatus =
  | 'not_registered'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'revoked';

export interface Zeluto2YolksConfig {
  zelutoUrl?: string;
  clientSecret?: string;
  syncSecret?: string;
  brandOrgId?: string;
}

export interface Zeluto2YolksLinks {
  brandWorkspaceUrl: string;
  platformAdminUrl: string;
  workspaceUrl: string | null;
  subscribersUrl: string | null;
  deliverySetupUrl: string | null;
}

export function resolve2YolksZelutoBase(zelutoUrl?: string): string {
  return (zelutoUrl?.trim() || 'https://zeluto.com').replace(/\/+$/, '');
}

export function build2YolksZelutoLinks(
  config: Zeluto2YolksConfig,
  zelutoOrgId?: string | null,
): Zeluto2YolksLinks {
  const base = resolve2YolksZelutoBase(config.zelutoUrl);
  const brandWorkspaceUrl = config.brandOrgId?.trim()
    ? `${base}/app/w/${encodeURIComponent(config.brandOrgId.trim())}/crm/contacts`
    : `${base}/app/crm/contacts`;
  const platformAdminUrl = `${base}/app/platform-admin/registrations`;
  if (!zelutoOrgId?.trim()) {
    return {
      brandWorkspaceUrl,
      platformAdminUrl,
      workspaceUrl: null,
      subscribersUrl: null,
      deliverySetupUrl: null,
    };
  }
  const workspaceUrl = `${base}/app/w/${encodeURIComponent(zelutoOrgId.trim())}`;
  return {
    brandWorkspaceUrl,
    platformAdminUrl,
    workspaceUrl,
    subscribersUrl: `${workspaceUrl}/crm/contacts?stage=subscriber`,
    deliverySetupUrl: `${workspaceUrl}/delivery/providers`,
  };
}

export async function push2YolksContactToZeluto(
  config: Zeluto2YolksConfig,
  contact: {
    email: string;
    firstName?: string;
    externalId: string;
    externalEntityType: 'user' | 'creator_subscriber';
    stage: 'subscriber' | 'creator';
    externalUrlPath?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
  },
  tenantId?: string | null,
): Promise<{ ok: boolean; status?: number; zelutoId?: string }> {
  if (!config.clientSecret?.trim()) return { ok: false };
  const url = `${resolve2YolksZelutoBase(config.zelutoUrl)}/api/v1/ingest/contacts`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.clientSecret.trim()}`,
  };
  if (tenantId?.trim()) headers['X-Tenant-Id'] = tenantId.trim();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(contact),
    });
    if (!res.ok && res.status !== 409) return { ok: false, status: res.status };
    const body = (await res.json().catch(() => null)) as {
      zelutoId?: string;
      data?: { zelutoId?: string };
    } | null;
    const zelutoId = body?.zelutoId ?? body?.data?.zelutoId;
    return { ok: true, status: res.status, ...(zelutoId ? { zelutoId } : {}) };
  } catch {
    return { ok: false };
  }
}

export interface CreatorRegistrationResult {
  ok: boolean;
  statusCode?: number;
  status?: ZelutoConnectionStatus;
  requestId?: string | null;
  zelutoOrganizationId?: string | null;
  emailSendReady?: boolean;
  rejectionReason?: string | null;
  error?: string;
}

export async function request2YolksCreatorRegistration(
  config: Zeluto2YolksConfig,
  params: {
    creatorId: string;
    creatorName: string;
    adminEmail: string;
  },
): Promise<CreatorRegistrationResult> {
  if (!config.clientSecret?.trim()) {
    return { ok: false, error: 'Zeluto client secret is not configured' };
  }
  const externalTenantId = `creator:${params.creatorId}`;
  const url = `${resolve2YolksZelutoBase(config.zelutoUrl)}/api/v1/ingest/registrations`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.clientSecret.trim()}`,
      },
      body: JSON.stringify({
        externalTenantId,
        facilityName: params.creatorName,
        adminEmail: params.adminEmail,
        adminName: params.creatorName,
        externalUserId: params.creatorId,
        externalFacilityUrl: 'https://2yolks.com/account/subscribers',
      }),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      return {
        ok: false,
        statusCode: res.status,
        error: (body?.error as string) || `Registration failed (${res.status})`,
      };
    }
    return {
      ok: true,
      statusCode: res.status,
      status: (body.status as ZelutoConnectionStatus) ?? 'pending_approval',
      requestId: (body.requestId as string | null) ?? null,
      zelutoOrganizationId: (body.zelutoOrganizationId as string | null) ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function get2YolksCreatorRegistrationStatus(
  config: Zeluto2YolksConfig,
  creatorId: string,
): Promise<CreatorRegistrationResult> {
  if (!config.clientSecret?.trim()) {
    return { ok: false, error: 'Zeluto client secret is not configured' };
  }
  const externalTenantId = `creator:${creatorId}`;
  const url = `${resolve2YolksZelutoBase(config.zelutoUrl)}/api/v1/ingest/registrations/${encodeURIComponent(externalTenantId)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.clientSecret.trim()}` },
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      return {
        ok: false,
        statusCode: res.status,
        error: (body?.error as string) || `Status check failed (${res.status})`,
      };
    }
    return {
      ok: true,
      statusCode: res.status,
      status: (body.status as ZelutoConnectionStatus) ?? 'not_registered',
      requestId: (body.requestId as string | null) ?? null,
      zelutoOrganizationId: (body.zelutoOrganizationId as string | null) ?? null,
      emailSendReady: Boolean(body.emailSendReady),
      rejectionReason: (body.rejectionReason as string | null) ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export type SyncBindings = {
  DB: D1Database;
  ZELUTO_SYNC_SECRET?: string;
  ADMIN_MCP_API_KEY?: string;
};

export const zeluto2YolksSyncApp = new Hono<{ Bindings: SyncBindings }>();

zeluto2YolksSyncApp.use('*', async (c, next) => {
  const expected = (c.env.ZELUTO_SYNC_SECRET || c.env.ADMIN_MCP_API_KEY || '').trim();
  if (!expected) return c.json({ error: 'ZELUTO_SYNC_SECRET not configured' }, 503);
  const auth = c.req.header('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const provided = m?.[1]?.trim();
  if (!provided || !constantTimeEqual(provided, expected)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

zeluto2YolksSyncApp.get('/tenants', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT u.id
     FROM users u
     WHERE u.zeluto_connection_status = 'approved'
       AND EXISTS (SELECT 1 FROM recipes r WHERE r.owner_user_id = u.id AND r.submitted_at IS NOT NULL)`,
  ).all<{ id: string }>();
  return c.json({ tenants: (rows.results ?? []).map((r) => `creator:${r.id}`) }, 200);
});

zeluto2YolksSyncApp.get('/records', async (c) => {
  const rawLimit = Number(c.req.query('limit') || '200');
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 500) : 200;
  const records: Array<Record<string, unknown>> = [];

  // 1. Unified users (subscriber by default -> becomes Creator once a recipe is submitted)
  const userRows = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.zeluto_contact_id, u.zeluto_connection_status,
            u.marketing_opt_in, u.unsubscribed_at,
            EXISTS (SELECT 1 FROM recipes r WHERE r.owner_user_id = u.id AND r.submitted_at IS NOT NULL) AS is_creator
     FROM users u
     ORDER BY u.created_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<Record<string, unknown>>();

  for (const r of userRows.results ?? []) {
    const isCreator = Number(r.is_creator ?? 0) === 1;
    const sup = Number(r.marketing_opt_in ?? 1) !== 1 || Boolean(r.unsubscribed_at);
    const id = String(r.id);
    records.push({
      externalId: id,
      externalEntityType: 'user',
      email: String(r.email),
      ...(r.display_name ? { firstName: String(r.display_name) } : {}),
      stage: isCreator ? 'creator' : 'subscriber',
      marketingOptIn: !sup,
      externalTenantId: isCreator ? `creator:${id}` : null,
      tenantApproved: r.zeluto_connection_status === 'approved',
      isCreatorSharedRecipe: isCreator,
      zelutoId: r.zeluto_contact_id ? String(r.zeluto_contact_id) : null,
      externalUrlPath: '/account',
      suppressed: sup,
    });
  }

  // 2. Creator-scoped subscriber relationships (strictly isolated to approved Creators who shared a recipe)
  const csRows = await c.env.DB.prepare(
    `SELECT cs.id, cs.creator_user_id, cs.zeluto_contact_id, cs.unsubscribed_at AS cs_unsub,
            sub.email AS sub_email, sub.display_name AS sub_name,
            sub.marketing_opt_in AS sub_opt_in, sub.unsubscribed_at AS sub_unsub,
            cr.zeluto_connection_status AS creator_status,
            EXISTS (SELECT 1 FROM recipes r WHERE r.owner_user_id = cs.creator_user_id AND r.submitted_at IS NOT NULL) AS creator_shared
     FROM creator_subscribers cs
     JOIN users sub ON sub.id = cs.subscriber_user_id
     JOIN users cr ON cr.id = cs.creator_user_id
     ORDER BY cs.created_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<Record<string, unknown>>();

  for (const r of csRows.results ?? []) {
    const creatorShared = Number(r.creator_shared ?? 0) === 1;
    const sup = Number(r.sub_opt_in ?? 1) !== 1 || Boolean(r.sub_unsub) || Boolean(r.cs_unsub);
    records.push({
      externalId: String(r.id),
      externalEntityType: 'creator_subscriber',
      email: String(r.sub_email),
      ...(r.sub_name ? { firstName: String(r.sub_name) } : {}),
      stage: 'subscriber',
      marketingOptIn: !sup,
      externalTenantId: `creator:${String(r.creator_user_id)}`,
      tenantApproved: r.creator_status === 'approved',
      isCreatorSharedRecipe: creatorShared,
      zelutoId: r.zeluto_contact_id ? String(r.zeluto_contact_id) : null,
      externalUrlPath: '/account/subscribers',
      suppressed: sup,
    });
  }

  return c.json({ records }, 200);
});

zeluto2YolksSyncApp.post('/suppressions', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    tenantId?: string | null;
    suppressions?: Array<{ email?: string; reason?: string }>;
  };
  const tenantId = body.tenantId?.trim() || null;
  const nowIso = new Date().toISOString();
  let applied = 0;

  for (const item of body.suppressions ?? []) {
    const email = (item.email || '').trim().toLowerCase();
    if (!email) continue;
    if (!tenantId) {
      const r1 = await c.env.DB.prepare(
        `UPDATE users SET marketing_opt_in = 0, unsubscribed_at = COALESCE(unsubscribed_at, ?) WHERE LOWER(TRIM(email)) = ?`,
      )
        .bind(nowIso, email)
        .run();
      const r2 = await c.env.DB.prepare(
        `UPDATE creator_subscribers
         SET unsubscribed_at = COALESCE(unsubscribed_at, ?), updated_at = ?
         WHERE subscriber_user_id IN (SELECT id FROM users WHERE LOWER(TRIM(email)) = ?)`,
      )
        .bind(nowIso, nowIso, email)
        .run();
      applied += Number(r1.meta?.changes ?? 0) + Number(r2.meta?.changes ?? 0);
    } else {
      const creatorId = tenantId.startsWith('creator:') ? tenantId.slice('creator:'.length) : tenantId;
      const r = await c.env.DB.prepare(
        `UPDATE creator_subscribers
         SET unsubscribed_at = COALESCE(unsubscribed_at, ?), updated_at = ?
         WHERE creator_user_id = ?
           AND subscriber_user_id IN (SELECT id FROM users WHERE LOWER(TRIM(email)) = ?)`,
      )
        .bind(nowIso, nowIso, creatorId, email)
        .run();
      applied += Number(r.meta?.changes ?? 0);
    }
  }
  return c.json({ applied }, 200);
});

zeluto2YolksSyncApp.post('/id-mappings', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    tenantId?: string | null;
    mappings?: Array<{ externalId?: string; externalEntityType?: string; zelutoId?: string }>;
  };
  const nowIso = new Date().toISOString();
  let saved = 0;
  for (const item of body.mappings ?? []) {
    const extId = item.externalId?.trim();
    const zId = item.zelutoId?.trim();
    if (!extId || !zId) continue;
    if (item.externalEntityType === 'creator_subscriber') {
      const r = await c.env.DB.prepare(
        `UPDATE creator_subscribers
         SET zeluto_contact_id = ?, zeluto_pushed_at = COALESCE(zeluto_pushed_at, ?), updated_at = ?
         WHERE id = ?`,
      )
        .bind(zId, nowIso, nowIso, extId)
        .run();
      saved += Number(r.meta?.changes ?? 0);
    } else {
      const r = await c.env.DB.prepare(`UPDATE users SET zeluto_contact_id = ? WHERE id = ?`)
        .bind(zId, extId)
        .run();
      saved += Number(r.meta?.changes ?? 0);
    }
  }
  return c.json({ saved }, 200);
});

zeluto2YolksSyncApp.post('/outcomes', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    outcomes?: Array<{ externalId?: string; externalEntityType?: string; zelutoId?: string }>;
  };
  const nowIso = new Date().toISOString();
  let updated = 0;
  for (const item of body.outcomes ?? []) {
    const extId = item.externalId?.trim();
    const zId = item.zelutoId?.trim();
    if (!extId || !zId) continue;
    if (item.externalEntityType === 'creator_subscriber') {
      const r = await c.env.DB.prepare(
        `UPDATE creator_subscribers SET zeluto_contact_id = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(zId, nowIso, extId)
        .run();
      updated += Number(r.meta?.changes ?? 0);
    } else {
      const r = await c.env.DB.prepare(`UPDATE users SET zeluto_contact_id = ? WHERE id = ?`)
        .bind(zId, extId)
        .run();
      updated += Number(r.meta?.changes ?? 0);
    }
  }
  return c.json({ updated }, 200);
});
