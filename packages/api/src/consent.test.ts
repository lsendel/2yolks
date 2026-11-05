// C2 consent flow service layer, tested against the REV 9 design schema
// (design/0007-consent-revisions.sql applied on top of all migrations).
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeD1 } from './testd1';
import { canonicalSnapshot } from '@2yolks/contracts';
import { consentFlowEnabled, schemaProbe, buildSnapshotFromLive, saveRevision, recordConsent, publishRevision, disableRecipe } from './consent';

const USER = 'user-1';
const RECIPE = 'rec-1';
let sqlite: DatabaseSync;
let DB: D1Database;

function fresh() {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.exec(readFileSync(new URL('../../../design/0007-consent-revisions.sql', import.meta.url), 'utf8'));
  sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('${USER}', 'ana@example.com', '2026-01-01'), ('admin-1', 'admin@example.com', '2026-01-01')`);
  sqlite.exec(`INSERT INTO sources (id, name, url, license) VALUES ('src-1', 'Ana', 'https://2yolks.com/', 'user-original')`);
  sqlite.exec(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('${RECIPE}', 'src-1', 'us', '2026-01-01', '${USER}')`);
  DB = makeD1(sqlite);
}
beforeEach(fresh);

const snap1 = (title: string) =>
  canonicalSnapshot({
    recipe: { author_name: null, base_servings: null, category: null, cook_minutes: null, origin_country: 'us', prep_minutes: null, rest_minutes: null, total_minutes: null },
    source: { name: 'Ana', url: 'https://2yolks.com/', license: 'user-original' },
    locales: { 'us:en': { title, slug: 'soup-x', intro: null, ingredients: ['1 egg'], steps: ['Cook.'] } },
    images: [],
  });

describe('gates', () => {
  it('the flow is disabled by default and probes the 0007 schema', async () => {
    expect(consentFlowEnabled({})).toBe(false);
    expect(consentFlowEnabled({ CONSENT_FLOW_ENABLED: 'true' })).toBe(true);
    expect(await schemaProbe(DB)).toBe(true);
    const bare = makeD1(new DatabaseSync(':memory:'));
    expect(await schemaProbe(bare)).toBe(false);
  });
});

describe('saveRevision', () => {
  it('writes a revision and derives live rows from the snapshot', async () => {
    const snap = await snap1('Soup');
    expect(await saveRevision(DB, RECIPE, USER, 'rev-a', 0, snap)).toEqual({ ok: true });
    const l = await DB.prepare(`SELECT title, status FROM recipe_locales WHERE recipe_id = ?`).bind(RECIPE).first<{ title: string; status: string }>();
    expect(l).toEqual({ title: 'Soup', status: 'draft' });
  });
  it('a stale expected head aborts the whole batch', async () => {
    expect(await saveRevision(DB, RECIPE, USER, 'rev-a', 0, await snap1('Soup'))).toEqual({ ok: true });
    const res = await saveRevision(DB, RECIPE, USER, 'rev-b', 0, await snap1('Stale'));
    expect(res.ok).toBe(false);
    expect((await DB.prepare(`SELECT count(*) n FROM recipe_revisions`).first<{ n: number }>())!.n).toBe(1);
  });
  it('a non-owner cannot save', async () => {
    sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('user-2', 'o@example.com', '2026-01-01')`);
    const res = await saveRevision(DB, RECIPE, 'user-2', 'rev-a', 0, await snap1('Soup'));
    expect(res.ok).toBe(false);
  });
});

describe('consent -> publish -> serve -> withdraw', () => {
  it('the full loop works and revocation removes the recipe from effective serving', async () => {
    expect(await saveRevision(DB, RECIPE, USER, 'rev-a', 0, await snap1('Soup'))).toEqual({ ok: true });
    expect(await recordConsent(DB, RECIPE, { id: 'ce-1', revisionId: 'rev-a', expectedSeq: 0, event: 'grant', userId: USER, licenseVersion: 'public-license-v1', licenseLang: 'en' })).toEqual({ ok: true });
    expect(await publishRevision(DB, RECIPE, 'rev-a', 'admin-1', 'public-license-v1', 'en', 'pub-1')).toEqual({ ok: true });
    const served = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = ?`).bind(RECIPE).first<{ n: number }>();
    expect(served!.n).toBe(1);
    // withdrawal (policy wording still pending Luis; mechanics proven)
    expect(await recordConsent(DB, RECIPE, { id: 'ce-2', revisionId: 'rev-a', expectedSeq: 1, event: 'revoke', userId: USER, licenseVersion: 'public-license-v1', licenseLang: 'en' })).toEqual({ ok: true });
    const after = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = ?`).bind(RECIPE).first<{ n: number }>();
    expect(after!.n).toBe(0);
  });
  it('publish without a grant fails closed; moderation disable works', async () => {
    expect(await saveRevision(DB, RECIPE, USER, 'rev-a', 0, await snap1('Soup'))).toEqual({ ok: true });
    const res = await publishRevision(DB, RECIPE, 'rev-a', 'admin-1', 'public-license-v1', 'en', 'pub-1');
    expect(res.ok).toBe(false);
    await recordConsent(DB, RECIPE, { id: 'ce-1', revisionId: 'rev-a', expectedSeq: 0, event: 'grant', userId: USER, licenseVersion: 'public-license-v1', licenseLang: 'en' });
    expect(await publishRevision(DB, RECIPE, 'rev-a', 'admin-1', 'public-license-v1', 'en', 'pub-2')).toEqual({ ok: true });
    expect(await disableRecipe(DB, RECIPE)).toEqual({ ok: true });
    const st = await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(RECIPE).first<{ status: string }>();
    expect(st!.status).toBe('draft');
  });
});

describe('buildSnapshotFromLive', () => {
  it('round-trips live rows into the canonical form', async () => {
    expect(await saveRevision(DB, RECIPE, USER, 'rev-a', 0, await snap1('Soup'))).toEqual({ ok: true });
    const snap = await buildSnapshotFromLive(DB, RECIPE);
    expect(snap).not.toBeNull();
    const parsed = JSON.parse(snap!.json) as { locales: Record<string, { title: string }> };
    expect(parsed.locales['us:en']!.title).toBe('Soup');
    expect(snap!.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
