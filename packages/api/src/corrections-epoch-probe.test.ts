// REV 15 DESIGN PROBE - return-for-corrections epoch semantics
// (design/0012-corrections-epoch.sql, design/0011 G9 option A).
// Design-only executable proof on the ACTUAL schema (migrations 0001-0006 +
// design 0007-0010 + design 0012) with raw SQL: no routes, no MCP tool, no
// production wiring. Each test names the review probe it answers.
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeD1 } from './testd1';
import { canonicalSnapshot, type SnapImage } from '@2yolks/contracts';

let DB: D1Database;
const USER = 'user-1';
const ADMIN_KEY = 'harvester-admin'; // MCP key identity (opaque string, like mcp_audit.actor)
const DIGEST = 'a'.repeat(64);
const IMG: SnapImage = { image_id: 'img-r1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: 'https://2yolks.com/', license: 'proprietary', sha256: DIGEST, provenance: 'own', provenance_note: null };

function makeDb(withDesign: boolean) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  if (withDesign) {
    for (const file of ['0007-consent-revisions.sql', '0008-consent-scope.sql', '0009-image-provenance.sql', '0010-content-fence.sql', '0012-corrections-epoch.sql']) {
      sqlite.exec(readFileSync(new URL(`../../../design/${file}`, import.meta.url), 'utf8'));
    }
  }
  return makeD1(sqlite);
}
beforeEach(() => { DB = makeDb(true); });

const snap = async (title: string, slug = 'soup-x', images: SnapImage[] = []) =>
  await canonicalSnapshot({
    recipe: { author_name: null, base_servings: null, category: null, cook_minutes: null, origin_country: 'us', prep_minutes: null, rest_minutes: null, total_minutes: null },
    source: { name: 'Ana', url: 'https://2yolks.com/', license: 'user-original' },
    locales: { 'us:en': { title, slug, intro: null, ingredients: ['1 egg'], steps: ['Cook.'] } },
    images,
  });

async function seedRecipe(id: string, opts: { submitted?: boolean; owner?: string | null } = {}) {
  await DB.prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, '2026-01-01')`).bind(USER, 'ana@example.com').run().catch(() => {});
  await DB.prepare(`INSERT INTO sources (id, name, url, license) VALUES ('src-' || ?, 'Ana', 'https://2yolks.com/', 'user-original')`).bind(id).run();
  await DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id, submitted_at) VALUES (?, 'src-' || ?, 'us', '2026-01-01', ?, ?)`)
    .bind(id, id, opts.owner === undefined ? USER : opts.owner, opts.submitted ? '2026-01-02T00:00:00Z' : null).run();
  await DB.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, 'us', 'en', 'Soup', 'soup-' || ?, NULL, '["1 egg"]', '["Cook."]', 'draft')`).bind(id, id).run();
}
async function sealRevision(id: string, revId: string, seq: number, title = 'Soup', images: SnapImage[] = []) {
  const s = await snap(title, 'soup-' + id, images);
  await DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(revId, id, seq, s.hash, s.json, USER).run();
}
async function grant(id: string, revId: string, consentId: string, seq: number, scope: 'text' | 'images' = 'text', epoch?: number) {
  const cols = epoch === undefined ? '' : ', epoch';
  const vals = epoch === undefined ? '' : `, ${epoch}`;
  await DB.prepare(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang, scope${cols}) VALUES (?, ?, ?, ?, 'grant', ?, 'public', 'public-v1', 'en', ?${vals})`)
    .bind(consentId, id, revId, seq, USER, scope).run();
}
async function requestPublish(id: string, revId: string, reqId: string, epoch?: number) {
  const cols = epoch === undefined ? '' : ', epoch';
  const vals = epoch === undefined ? '' : `, ${epoch}`;
  await DB.batch([
    DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang${cols}) VALUES (?, ?, ?, ?, 'public-v1', 'en'${vals})`).bind(reqId, id, revId, USER),
    DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = ? AND country = 'us' AND lang = 'en' AND status <> 'published'`).bind(id),
    DB.prepare(`UPDATE publish_requests SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL`).bind(reqId),
  ]);
}
const opTuple = (id: string, over: Record<string, unknown> = {}) => ({
  op: 'op-1', recipe: id, owner: USER, head: 'rev-' + id, headSeq: 1, epoch: 0, submission: '2026-01-02T00:00:00Z', note: 'correction needed', actor: ADMIN_KEY, ...over,
});
/** The service batch is EXACTLY two statements; the transition trigger owns consume + audit. */
function returnBatch(t: { op: string; recipe: string; owner: string; head: string | null; headSeq: number | null; epoch: number; submission: string; note?: string; actor?: string }) {
  return DB.batch([
    DB.prepare(`INSERT INTO return_operations (op_id, recipe_id, expected_owner, expected_head, expected_head_seq, expected_epoch, expected_submission, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(t.op, t.recipe, t.owner, t.head, t.headSeq, t.epoch, t.submission, t.actor ?? ADMIN_KEY, t.note ?? 'correction needed'),
    DB.prepare(`UPDATE recipes SET submitted_at = NULL, corrections_epoch = corrections_epoch + 1 WHERE id = ?`).bind(t.recipe),
  ]);
}
/** Direct op insert only (simulates a pending op with no transition in the same unit). */
function insertOpOnly(t: { op: string; recipe: string; owner: string; head: string | null; headSeq: number | null; epoch: number; submission: string }) {
  return DB.prepare(`INSERT INTO return_operations (op_id, recipe_id, expected_owner, expected_head, expected_head_seq, expected_epoch, expected_submission, actor, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'correction needed')`).bind(t.op, t.recipe, t.owner, t.head, t.headSeq, t.epoch, t.submission, ADMIN_KEY).run();
}
const epochOf = async (id: string) => (await DB.prepare(`SELECT corrections_epoch e FROM recipes WHERE id = ?`).bind(id).first<{ e: number }>())!.e;
const auditRows = async () => (await DB.prepare(`SELECT actor, details_json FROM mcp_audit WHERE tool = 'recipes.return_for_corrections'`).all<{ actor: string; details_json: string }>())!.results ?? [];
const statusOf = async (id: string) => (await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = ?`).bind(id).first<{ status: string }>())!.status;
const markerOf = async (id: string) => (await DB.prepare(`SELECT first_published_at m FROM recipes WHERE id = ?`).bind(id).first<{ m: string | null }>())!.m;
async function consentedSubmitted(id: string, images: SnapImage[] = []) {
  await seedRecipe(id);
  await sealRevision(id, 'rev-' + id, 1, 'Soup', images);
  await grant(id, 'rev-' + id, 'ce-' + id + '-1', 1);
  await DB.prepare(`UPDATE recipes SET submitted_at = '2026-01-02T00:00:00Z' WHERE id = ?`).bind(id).run();
}

describe('return-for-corrections epoch probe (design/0012 REV 15)', () => {
  it('happy return: op validates, transition fires, trigger consumes op + writes exactly one audit', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    expect(await epochOf('r1')).toBe(1);
    expect((await DB.prepare(`SELECT submitted_at FROM recipes WHERE id = 'r1'`).first<{ submitted_at: string | null }>())!.submitted_at).toBeNull();
    expect((await DB.prepare(`SELECT consumed_at FROM return_operations WHERE op_id = 'op-1'`).first<{ consumed_at: string | null }>())!.consumed_at).toBeTruthy();
    const audit = await auditRows();
    expect(audit.length).toBe(1);
    expect(audit[0]!.actor).toBe(ADMIN_KEY);
    expect(JSON.parse(audit[0]!.details_json)).toMatchObject({ op_id: 'op-1', old_epoch: 0, new_epoch: 1 });
  });

  it('barrier: after the return the OLD grant cannot drive a new publish request', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await expect(requestPublish('r1', 'rev-r1', 'req-2', 1)).rejects.toThrow(/no current text-scope grant/);
    expect(await statusOf('r1')).toBe('draft');
  });

  it('barrier: an orphan request from BEFORE the return cannot flip afterwards', async () => {
    await consentedSubmitted('r1');
    await DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES ('req-0', 'r1', 'rev-r1', ?, 'public-v1', 'en')`).bind(USER).run();
    await returnBatch(opTuple('r1'));
    await expect(DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = 'r1'`).run()).rejects.toThrow(/publish guard failed/);
    expect(await statusOf('r1')).toBe('draft');
    expect((await DB.prepare(`SELECT consumed_at FROM publish_requests WHERE id = 'req-0'`).first<{ consumed_at: string | null }>())!.consumed_at).toBeNull();
  });

  it('race loser: a second return with the same inspected tuple has ZERO effects', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await expect(returnBatch(opTuple('r1', { op: 'op-2' }))).rejects.toThrow(/expectation does not match current state|pending return operation/);
    expect(await epochOf('r1')).toBe(1);
    expect((await DB.prepare(`SELECT count(*) n FROM return_operations`).first<{ n: number }>())!.n).toBe(1);
    expect((await auditRows()).length).toBe(1);
  });

  it('replay: the same op_id can never be reused', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await DB.prepare(`UPDATE recipes SET submitted_at = '2026-01-03T00:00:00Z' WHERE id = 'r1'`).run();
    await expect(returnBatch(opTuple('r1', { epoch: 1, submission: '2026-01-03T00:00:00Z' }))).rejects.toThrow(/append-only|UNIQUE/);
    expect(await epochOf('r1')).toBe(1);
  });

  it('CAS: every expected-tuple dimension is asserted (owner/head/head_seq/epoch/submission)', async () => {
    await consentedSubmitted('r1');
    for (const [key, val] of [['owner', 'user-2'], ['head', 'rev-9'], ['headSeq', 2], ['epoch', 1], ['submission', '2026-01-09T00:00:00Z']] as const) {
      await expect(returnBatch(opTuple('r1', { [key]: val }))).rejects.toThrow(/expectation does not match current state/);
    }
    expect(await epochOf('r1')).toBe(0);
    expect((await auditRows()).length).toBe(0);
  });

  it('note hygiene: blank/whitespace/over-500 notes and blank actor abort', async () => {
    await consentedSubmitted('r1');
    await expect(returnBatch(opTuple('r1', { note: '   ' }))).rejects.toThrow(/actor and note required/);
    await expect(returnBatch(opTuple('r1', { note: 'x'.repeat(501) }))).rejects.toThrow(/actor and note required/);
    await expect(returnBatch(opTuple('r1', { actor: ' ' }))).rejects.toThrow(/actor and note required/);
    expect((await DB.prepare(`SELECT count(*) n FROM return_operations`).first<{ n: number }>())!.n).toBe(0);
  });

  it('probe 1: a pending op can NEVER be consumed or audited without its transition', async () => {
    await consentedSubmitted('r1');
    await insertOpOnly(opTuple('r1', { actor: 'anyone-claiming-anything' })); // SQL layer: actor is opaque text; RBAC binds it at the MCP boundary
    await expect(DB.prepare(`UPDATE return_operations SET consumed_at = datetime('now') WHERE op_id = 'op-1'`).run()).rejects.toThrow(/consumed only by their epoch transition/);
    await expect(DB.prepare(`INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES ('anyone-claiming-anything', 'admin', 'recipes.return_for_corrections', 'r1', '{"op_id":"op-1"}')`).run()).rejects.toThrow(/come only from the transition trigger/);
    expect((await DB.prepare(`SELECT consumed_at FROM return_operations WHERE op_id = 'op-1'`).first<{ consumed_at: string | null }>())!.consumed_at).toBeNull();
    expect((await auditRows()).length).toBe(0);
    // and a second pending op for the same recipe is refused
    await expect(insertOpOnly(opTuple('r1', { op: 'op-dup' }))).rejects.toThrow(/pending return operation/);
  });

  it('probe 1: audit rows are immutable and non-duplicable', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await expect(DB.prepare(`UPDATE mcp_audit SET actor = 'mallory' WHERE tool = 'recipes.return_for_corrections'`).run()).rejects.toThrow(/immutable/);
    await expect(DB.prepare(`DELETE FROM mcp_audit WHERE tool = 'recipes.return_for_corrections'`).run()).rejects.toThrow(/immutable/);
    await expect(DB.prepare(`INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES (?, 'admin', 'recipes.return_for_corrections', 'r1', '{"op_id":"op-1"}')`).bind(ADMIN_KEY).run()).rejects.toThrow(/come only from the transition trigger/);
  });

  it('probe 2: a standalone transition on a validated op completes WITH consume + audit (SQL-enforced, no service claim)', async () => {
    await consentedSubmitted('r1');
    await insertOpOnly(opTuple('r1'));            // pending op, no batch
    await DB.prepare(`UPDATE recipes SET submitted_at = NULL, corrections_epoch = corrections_epoch + 1 WHERE id = 'r1'`).run();
    expect(await epochOf('r1')).toBe(1);
    expect((await DB.prepare(`SELECT consumed_at FROM return_operations WHERE op_id = 'op-1'`).first<{ consumed_at: string | null }>())!.consumed_at).toBeTruthy();
    expect((await auditRows()).length).toBe(1);   // audit exists BECAUSE the transition happened
  });

  it('probe 3: no INSERT can introduce a nonzero epoch', async () => {
    await seedRecipe('r1');
    await expect(DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, corrections_epoch) VALUES ('r2', 'src-r1', 'us', '2026-01-01', 99)`).run()).rejects.toThrow(/starts at 0/);
  });

  it('epoch tamper: direct writes, decreases, op-less transitions and REPLACE resets all abort', async () => {
    await consentedSubmitted('r1');
    await expect(DB.prepare(`UPDATE recipes SET corrections_epoch = 99 WHERE id = 'r1'`).run()).rejects.toThrow(/validated return operation/);
    await expect(DB.prepare(`UPDATE recipes SET corrections_epoch = corrections_epoch - 1 WHERE id = 'r1'`).run()).rejects.toThrow(/validated return operation/);
    await returnBatch(opTuple('r1'));
    await expect(DB.prepare(`INSERT OR REPLACE INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('r1', 'src-r1', 'us', '2026-01-01', ?)`).bind(USER).run()).rejects.toThrow(/guarded flow state/);
    expect(await epochOf('r1')).toBe(1);
  });

  it('epoch integrity: consent events and publish requests only stamp the current epoch', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await sealRevision('r1', 'rev-2', 2, 'Soup');
    await expect(grant('r1', 'rev-2', 'ce-2', 2, 'text', 0)).rejects.toThrow(/consent epoch/);
    await expect(DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang, epoch) VALUES ('req-9', 'r1', 'rev-2', ?, 'public-v1', 'en', 0)`).bind(USER).run()).rejects.toThrow(/request epoch/);
    await grant('r1', 'rev-2', 'ce-2', 2, 'text', 1);
    expect((await DB.prepare(`SELECT epoch FROM recipe_consent_events WHERE id = 'ce-2'`).first<{ epoch: number }>())!.epoch).toBe(1);
  });

  it('recovery: unchanged content re-granted at the new epoch publishes', async () => {
    await consentedSubmitted('r1');
    await returnBatch(opTuple('r1'));
    await sealRevision('r1', 'rev-2', 2);
    await grant('r1', 'rev-2', 'ce-2', 2, 'text', 1);
    await requestPublish('r1', 'rev-2', 'req-2', 1);
    expect(await statusOf('r1')).toBe('published');
  });

  it('marker: first actual flip stamps it, later flips never move it', async () => {
    await seedRecipe('r2');
    await sealRevision('r2', 'rev-1', 1);
    await grant('r2', 'rev-1', 'ce-1', 1);
    await requestPublish('r2', 'rev-1', 'req-1');
    const first = await markerOf('r2');
    expect(first).toBeTruthy();
    expect(first).not.toBe('1900-01-01T00:00:00Z');
    await DB.prepare(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = 'r2'`).run();
    await DB.prepare(`UPDATE recipe_locales SET title = 'Soup v2' WHERE recipe_id = 'r2'`).run();
    await sealRevision('r2', 'rev-2', 2, 'Soup v2');
    await grant('r2', 'rev-2', 'ce-2', 2);
    await requestPublish('r2', 'rev-2', 'req-2');
    expect(await markerOf('r2')).toBe(first);
  });

  it('marker tamper: clear, change, forged insert and published-insert all abort', async () => {
    await seedRecipe('r2');
    await sealRevision('r2', 'rev-1', 1);
    await grant('r2', 'rev-1', 'ce-1', 1);
    await requestPublish('r2', 'rev-1', 'req-1');
    await expect(DB.prepare(`UPDATE recipes SET first_published_at = NULL WHERE id = 'r2'`).run()).rejects.toThrow(/stamped once/);
    await expect(DB.prepare(`UPDATE recipes SET first_published_at = '2030-01-01' WHERE id = 'r2'`).run()).rejects.toThrow(/stamped once/);
    await expect(DB.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, first_published_at) VALUES ('r3', 'src-r2', 'us', '2026-01-01', '2026-06-01')`).run()).rejects.toThrow(/publish stamp|guard/);
    await expect(DB.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES ('r2', 'mx', 'es', 'Sopa', 'sopa-x', '[]', '[]', 'published')`).run()).rejects.toThrow(/publication only via the guarded flow/);
  });

  it('return rejects: sentinel (unknown legacy), ownerless, unsubmitted, currently published', async () => {
    await consentedSubmitted('r1');
    await DB.prepare(`UPDATE recipes SET first_published_at = '1900-01-01T00:00:00Z' WHERE id = 'r1'`).run();
    await expect(returnBatch(opTuple('r1'))).rejects.toThrow(/expectation does not match current state/);
    await consentedSubmitted('r2');
    await DB.prepare(`UPDATE recipes SET owner_user_id = NULL WHERE id = 'r2'`).run();
    await expect(returnBatch(opTuple('r2', { owner: '' }))).rejects.toThrow(/expectation does not match current state/);
    await seedRecipe('r3');
    await expect(returnBatch(opTuple('r3', { head: null, headSeq: null }))).rejects.toThrow(/expectation does not match current state/);
    await seedRecipe('r4');
    await sealRevision('r4', 'rev-r4', 1);
    await grant('r4', 'rev-r4', 'ce-r4', 1);
    await requestPublish('r4', 'rev-r4', 'req-r4');
    await expect(returnBatch(opTuple('r4', { submission: '' }))).rejects.toThrow(/expectation does not match current state/);
    expect((await auditRows()).length).toBe(0);
  });

  it('audit write failure rolls the WHOLE batch back: no transition, no op, no audit', async () => {
    await consentedSubmitted('r1');
    await DB.exec(`CREATE TRIGGER boom_before_audit BEFORE INSERT ON mcp_audit WHEN NEW.tool = 'recipes.return_for_corrections' BEGIN SELECT RAISE(ABORT, 'simulated audit write failure'); END`);
    await expect(returnBatch(opTuple('r1'))).rejects.toThrow(/simulated audit write failure/);
    expect(await epochOf('r1')).toBe(0);
    expect((await DB.prepare(`SELECT submitted_at FROM recipes WHERE id = 'r1'`).first<{ submitted_at: string | null }>())!.submitted_at).toBeTruthy();
    expect((await DB.prepare(`SELECT count(*) n FROM return_operations`).first<{ n: number }>())!.n).toBe(0);
    expect((await auditRows()).length).toBe(0);
    await DB.exec(`DROP TRIGGER boom_before_audit`);
  });

  it('both scopes, matching image-binding snapshot: fresh text + old images -> images barrier; old text + fresh images -> text barrier', async () => {
    await seedRecipe('r1');
    await DB.prepare(`INSERT INTO recipe_images (id, recipe_id, kind, step_index, r2_key, mime, bytes, style, source_name, source_url, license, sha256, provenance)
      VALUES ('img-r1', 'r1', 'hero', NULL, 'r2/img-1', 'image/jpeg', 10, 'photo', 'Ana', 'https://2yolks.com/', 'proprietary', ?, 'own')`).bind(DIGEST).run();
    const bindManifest = async (rev: string) =>
      DB.prepare(`INSERT INTO recipe_revision_images (revision_id, image_id, role, step_index, style, source_name, source_url, license, sha256, provenance)
        VALUES (?, 'img-r1', 'hero', NULL, 'photo', 'Ana', 'https://2yolks.com/', 'proprietary', ?, 'own')`).bind(rev, DIGEST).run();
    await sealRevision('r1', 'rev-r1', 1, 'Soup', [IMG]);
    await bindManifest('rev-r1');
    await grant('r1', 'rev-r1', 'ce-1', 1);
    await grant('r1', 'rev-r1', 'ce-2', 2, 'images');
    await DB.prepare(`UPDATE recipes SET submitted_at = '2026-01-02T00:00:00Z' WHERE id = 'r1'`).run();
    // sanity pre-return: the fully granted image-binding head CAN publish
    await returnBatch(opTuple('r1'));
    // (a) fresh TEXT grant only (new head, new epoch) -> images barrier
    await sealRevision('r1', 'rev-2', 2, 'Soup', [IMG]);
    await bindManifest('rev-2');
    await grant('r1', 'rev-2', 'ce-3', 3, 'text', 1);
    await expect(requestPublish('r1', 'rev-2', 'req-a', 1)).rejects.toThrow(/no current images-scope grant/);
    // (b) fresh IMAGES grant only -> text barrier
    await sealRevision('r1', 'rev-3', 3, 'Soup', [IMG]);
    await bindManifest('rev-3');
    await grant('r1', 'rev-3', 'ce-4', 4, 'images', 1);
    await expect(requestPublish('r1', 'rev-3', 'req-b', 1)).rejects.toThrow(/no current text-scope grant/);
    expect(await statusOf('r1')).toBe('draft');
  });

  it('the amended serving view carries BOTH epoch conjuncts (structural; behavioral mismatch is unreachable under the guards)', async () => {
    // Unreachable-by-design: the epoch can only advance via a return, and a
    // return requires verified-never-published - so a published row's epoch
    // never moves, and consent/request epochs always stamp current. The
    // conjuncts are defense-in-depth; this test pins their presence exactly.
    const v = (await DB.prepare(`SELECT sql FROM sqlite_master WHERE name = 'recipe_locales_effective'`).first<{ sql: string }>())!.sql;
    expect(v).toContain('p.epoch = (SELECT corrections_epoch FROM recipes WHERE id = p.recipe_id)');
    expect(v).toContain('e.epoch = (SELECT corrections_epoch FROM recipes WHERE id = e.recipe_id)');
    expect(v).toContain('ei.epoch = (SELECT corrections_epoch FROM recipes WHERE id = ei.recipe_id)');
  });
});

describe('migration classification (executed at apply time, legacy data predates the design SQL)', () => {
  it('classifies published vs unknown-history legacy rows, and post-migration rows keep a trustworthy NULL', async () => {
    // TRUE legacy: rows exist before ANY design SQL applies
    const legacy = makeDb(false);
    await legacy.prepare(`INSERT INTO users (id, email, created_at) VALUES ('user-1', 'ana@example.com', '2026-01-01')`).run();
    await legacy.prepare(`INSERT INTO sources (id, name, url, license) VALUES ('src-1', 'Ana', 'https://2yolks.com/', 'user-original')`).run();
    await legacy.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('leg-pub', 'src-1', 'us', '2024-01-01', 'user-1')`).run();
    await legacy.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES ('leg-pub', 'us', 'en', 'Old Soup', 'old-soup', '[]', '[]', 'published')`).run();
    await legacy.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('leg-draft', 'src-1', 'us', '2024-01-01', 'user-1')`).run();
    await legacy.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES ('leg-draft', 'us', 'en', 'Draft Soup', 'draft-soup', '[]', '[]', 'draft')`).run();
    // legacy orphan flip: published WITHOUT any request, then disabled
    await legacy.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('leg-orph', 'src-1', 'us', '2024-01-01', 'user-1')`).run();
    await legacy.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, ingredients_json, steps_json, status) VALUES ('leg-orph', 'us', 'en', 'Ghost Soup', 'ghost-soup', '[]', '[]', 'published')`).run();
    await legacy.prepare(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = 'leg-orph'`).run();
    // now the design SQL lands, ending with 0012's EXECUTED classification
    const sqlite = (legacy as unknown as { __sqlite?: DatabaseSync }).__sqlite; // not exposed; re-apply via exec path below
    // apply design files through the D1 shim's exec
    for (const file of ['0007-consent-revisions.sql', '0008-consent-scope.sql', '0009-image-provenance.sql', '0010-content-fence.sql', '0012-corrections-epoch.sql']) {
      await legacy.exec(readFileSync(new URL(`../../../design/${file}`, import.meta.url), 'utf8'));
    }
    const marker = async (id: string) => (await legacy.prepare(`SELECT first_published_at m FROM recipes WHERE id = ?`).bind(id).first<{ m: string | null }>())!.m;
    expect(await marker('leg-pub')).toBeTruthy();
    expect(await marker('leg-pub')).not.toBe('1900-01-01T00:00:00Z'); // real stamp: currently published at migration
    expect(await marker('leg-draft')).toBe('1900-01-01T00:00:00Z');    // unknown history: sentinel, fails closed
    expect(await marker('leg-orph')).toBe('1900-01-01T00:00:00Z');     // orphan flip + disable: sentinel too
    // post-migration recipe: trustworthy NULL until a real flip
    await legacy.prepare(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('new-1', 'src-1', 'us', '2026-01-01', 'user-1')`).run();
    expect(await marker('new-1')).toBeNull();
    // the amended serving view excludes unconsented legacy published rows
    // (the G6 read-path stop point owns any switch), and epoch defaults are 0
    expect((await legacy.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = 'leg-pub'`).first<{ n: number }>())!.n).toBe(0);
    expect((await legacy.prepare(`SELECT corrections_epoch e FROM recipes WHERE id = 'leg-pub'`).first<{ e: number }>())!.e).toBe(0);
  });
});
