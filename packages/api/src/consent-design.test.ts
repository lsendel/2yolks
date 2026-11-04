// Executable evidence for design/0007-consent-revisions.sql (REV 4):
// schema validity under enforced FKs, constraint-abort CAS rollback, and
// stale-head/replay/drift negatives. Single synchronous connection: these are
// stale-state and rollback proofs, not true-concurrency proofs. This is a
// design harness - nothing here is wired into testd1 or deploy.
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { makeD1 } from './testd1';

let sqlite: DatabaseSync;
let DB: D1Database;

const USER = 'user-1';
const RECIPE = 'rec-1';

function fresh() {
  sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.exec(readFileSync(new URL('../../../design/0007-consent-revisions.sql', import.meta.url), 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = ON');
  DB = makeD1(sqlite);
  sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('${USER}', 'cook@example.com', '2026-01-01')`);
  sqlite.exec(`INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('src-1', 'Ana', 'https://2yolks.com/', 'user-original', '2026-01-01')`);
  sqlite.exec(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('${RECIPE}', 'src-1', 'us', '2026-01-01', '${USER}')`);
  sqlite.exec(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${RECIPE}', 'us', 'en', 'Soup', 'soup-x', NULL, '["1 egg"]', '["Cook."]', 'draft')`);
}

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
// Canonical serialization: fixed key order, verbatim strings - no
// normalization. Two texts differing only in whitespace hash differently.
function canonicalSnapshot(fields: { title: string; intro: string; ingredients: string[]; steps: string[] }, images: { image_id: string; role: string; step_index: number | null; style: string; source_name: string; source_url: string; license: string; sha256: string }[]) {
  const manifest = images.map((i) => ({ image_id: i.image_id, role: i.role, step_index: i.step_index, style: i.style, source_name: i.source_name, source_url: i.source_url, license: i.license, sha256: i.sha256 }));
  const json = JSON.stringify({ fields: { ingredients: fields.ingredients, intro: fields.intro, steps: fields.steps, title: fields.title }, images: manifest });
  return { json, hash: sha(json) };
}
const fields = (t: string) => ({ title: t, intro: '', ingredients: ['1 egg'], steps: ['Cook.'] });

// Constraint-abort CAS: the revision INSERT is plain; a stale head or same-id
// replay violates UNIQUE(recipe_id, seq) / the PK and ABORTS the whole D1
// batch (real rollback). The locale write takes its values FROM the snapshot
// fields and carries its own owner/not-submitted guard; the caller asserts
// changes === 1 on every statement.
async function saveEdit(revisionId: string, expectedSeq: number, snap: { json: string; hash: string }, f: { title: string }) {
  try {
    const res = await DB.batch([
      DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES (?, '${RECIPE}', ?, ?, ?, '${USER}')`).bind(revisionId, expectedSeq + 1, snap.hash, snap.json),
      DB.prepare(`UPDATE recipe_locales SET title = ? WHERE recipe_id = '${RECIPE}' AND EXISTS (SELECT 1 FROM recipes WHERE id = '${RECIPE}' AND owner_user_id = '${USER}' AND submitted_at IS NULL)`).bind(f.title),
    ]);
    return res[0]!.meta.changes === 1 && res[1]!.meta.changes === 1;
  } catch {
    return false; // constraint abort: stale head or replay - caller returns 409
  }
}

// Consent grant/revoke: plain insert, UNIQUE(recipe_id, consent_seq) + PK
// abort on stale seq/replay; owner identity and revision coherence enforced
// in the insert itself.
async function consentEvent(id: string, revisionId: string, expectedSeq: number, event: 'grant' | 'revoke', licenseVersion = 'public-license-v1', licenseLang = 'en', userId = USER) {
  try {
    const res = await DB.batch([
      DB.prepare(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang) SELECT ?, '${RECIPE}', ?, ?, ?, '${userId}', 'public', ?, ? WHERE EXISTS (SELECT 1 FROM recipe_revisions r WHERE r.id = ? AND r.recipe_id = '${RECIPE}') AND EXISTS (SELECT 1 FROM recipes o WHERE o.id = '${RECIPE}' AND o.owner_user_id = '${userId}')`).bind(id, revisionId, expectedSeq + 1, event, licenseVersion, licenseLang, revisionId),
    ]);
    return res[0]!.meta.changes === 1;
  } catch {
    return false;
  }
}

// Publish: current head revision + latest event for the EXACT tuple is a
// grant + the live row still equals the bound snapshot content.
async function tryPublish(revisionId: string, userId = USER, licenseVersion = 'public-license-v1', licenseLang = 'en') {
  const grant = `EXISTS (
    SELECT 1 FROM recipe_consent_events e
    WHERE e.recipe_id = '${RECIPE}' AND e.revision_id = ? AND e.user_id = '${userId}'
      AND e.audience = 'public' AND e.license_version = '${licenseVersion}' AND e.license_lang = '${licenseLang}'
      AND e.event = 'grant'
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang)
  )`;
  const head = `(SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = '${RECIPE}') = (SELECT seq FROM recipe_revisions WHERE id = ?)`;
  const bound = `recipe_locales.title = (SELECT json_extract(r2.snapshot_json, '$.fields.title') FROM recipe_revisions r2 WHERE r2.id = ?)`;
  const res = await DB.batch([
    DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}' AND ${grant} AND ${head} AND ${bound}`).bind(revisionId, revisionId, revisionId),
  ]);
  return res[0]!.meta.changes === 1;
}

beforeEach(fresh);

describe('0007 schema', () => {
  it('applies under enforced foreign keys', () => {
    expect(() => sqlite.exec("INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json) VALUES ('rev-1', '" + RECIPE + "', 1, 'h', '{}')")).not.toThrow();
  });
  it('rejects a consent event whose revision belongs to another recipe', () => {
    sqlite.exec(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('rec-2', 'src-1', 'us', '2026-01-01', '${USER}')`);
    sqlite.exec(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json) VALUES ('rev-2', 'rec-2', 1, 'h', '{}')`);
    expect(() => sqlite.exec(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang) VALUES ('ce-1', '${RECIPE}', 'rev-2', 1, 'grant', '${USER}', 'public', 'public-license-v1', 'en')`)).toThrow(/FOREIGN KEY/);
  });
});

describe('CAS stale-head negatives (single connection; constraint abort is the rollback proof)', () => {
  it('two saves with the same expected head: exactly one wins, the loser rolls back', async () => {
    const snap = canonicalSnapshot(fields('Soup'), []);
    const a = await saveEdit('rev-a', 0, snap, fields('Soup A'));
    const b = await saveEdit('rev-b', 0, snap, fields('Soup B'));
    expect([a, b].sort()).toEqual([false, true]);
    const rows = await DB.prepare(`SELECT seq FROM recipe_revisions WHERE recipe_id = '${RECIPE}'`).all();
    expect(rows.results.length).toBe(1);
  });
  it('same-id replay with different content aborts and leaves prior state untouched', async () => {
    const s1 = canonicalSnapshot(fields('Original'), []);
    expect(await saveEdit('rev-a', 0, s1, fields('Original'))).toBe(true);
    const s2 = canonicalSnapshot(fields('Changed'), []);
    expect(await saveEdit('rev-a', 0, s2, fields('Changed'))).toBe(false);
    const row = await DB.prepare(`SELECT l.title, r.content_hash FROM recipe_locales l JOIN recipe_revisions r ON r.recipe_id = l.recipe_id WHERE l.recipe_id = '${RECIPE}'`).first<{ title: string; content_hash: string }>();
    expect(row!.title).toBe('Original');
    expect(row!.content_hash).toBe(s1.hash);
  });
  it('stale head after a newer revision aborts the whole batch (locale not mutated)', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await saveEdit('rev-b', 1, canonicalSnapshot(fields('Soup v2'), []), fields('Soup v2'))).toBe(true);
    expect(await saveEdit('rev-c', 0, canonicalSnapshot(fields('Stale'), []), fields('Stale'))).toBe(false);
    const t = await DB.prepare(`SELECT title FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ title: string }>();
    expect(t!.title).toBe('Soup v2');
    const n = await DB.prepare(`SELECT count(*) n FROM recipe_revisions WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(n!.n).toBe(2);
  });
  it('a grant for revision A never authorizes publishing revision B', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await saveEdit('rev-b', 1, canonicalSnapshot(fields('Soup edited'), []), fields('Soup edited'))).toBe(true);
    expect(await tryPublish('rev-b')).toBe(false);
    const st = await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ status: string }>();
    expect(st!.status).toBe('draft');
    expect(await tryPublish('rev-a')).toBe(false); // no longer head
  });
  it('publish succeeds only with a matching grant on the head revision and bound content', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
  });
  it('a live row drifted from the consented snapshot cannot be published', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Consent Soup'), []), fields('Consent Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    await DB.prepare(`UPDATE recipe_locales SET title = 'Unconsented title' WHERE recipe_id = '${RECIPE}'`).run();
    expect(await tryPublish('rev-a')).toBe(false);
    const st = await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ status: string }>();
    expect(st!.status).toBe('draft');
  });
  it('a revoke after the grant blocks publish; a re-grant unblocks it', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await consentEvent('ce-2', 'rev-a', 1, 'revoke')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await consentEvent('ce-3', 'rev-a', 2, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
  });
  it('a grant under different license wording or user does not satisfy the guard', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant', 'public-license-v1', 'en')).toBe(true);
    expect(await tryPublish('rev-a', USER, 'public-license-v2', 'en')).toBe(false);
    expect(await tryPublish('rev-a', 'someone-else', 'public-license-v1', 'en')).toBe(false);
  });
  it('two consent events with the same expected seq: exactly one wins, the loser aborts', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    const a = await consentEvent('ce-a', 'rev-a', 0, 'grant');
    const b = await consentEvent('ce-b', 'rev-a', 0, 'grant');
    expect([a, b].sort()).toEqual([false, true]);
  });
  it('a non-owner cannot grant consent (owner guard at insert)', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('user-2', 'other@example.com', '2026-01-01')`);
    expect(await consentEvent('ce-9', 'rev-a', 0, 'grant', 'public-license-v1', 'en', 'user-2')).toBe(false);
    expect(await tryPublish('rev-a', 'user-2')).toBe(false);
  });
  it('revisions, manifests and consent events are append-only (triggers abort UPDATE/DELETE)', async () => {
    expect(await saveEdit('rev-a', 0, canonicalSnapshot(fields('Soup'), []), fields('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    await expect(DB.prepare(`UPDATE recipe_revisions SET content_hash = 'x' WHERE id = 'rev-a'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`UPDATE recipe_revisions SET snapshot_json = '{}' WHERE id = 'rev-a'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_revisions WHERE id = 'rev-a'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`UPDATE recipe_consent_events SET license_version = 'v9' WHERE id = 'ce-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_consent_events WHERE id = 'ce-1'`).run()).rejects.toThrow(/append-only/);
    // A manifest row must exist for its per-row trigger to fire:
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/abc.webp', 'image/webp', 100, 'photo', 'Ana', '', 'proprietary', '2026-01-01', '2026-01-01')`);
    sqlite.exec(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', 'img-1', 'hero', 'photo', 'Ana', '', 'proprietary', 'abc')`);
    await expect(DB.prepare(`UPDATE recipe_revision_images SET sha256 = 'x' WHERE image_id = 'img-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_revision_images WHERE image_id = 'img-1'`).run()).rejects.toThrow(/append-only/);
  });
  it('whitespace-only text changes produce a different hash (verbatim snapshot)', () => {
    const a = canonicalSnapshot({ ...fields('Soup'), intro: 'Warm.' }, []);
    const b = canonicalSnapshot({ ...fields('Soup'), intro: 'Warm. ' }, []);
    expect(a.hash).not.toBe(b.hash);
  });
  it('image manifest participates in the hash', () => {
    const img = { image_id: 'img-1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: '', license: 'proprietary', sha256: 'abc' };
    const withImg = canonicalSnapshot(fields('Soup'), [img]);
    const without = canonicalSnapshot(fields('Soup'), []);
    const otherBytes = canonicalSnapshot(fields('Soup'), [{ ...img, sha256: 'def' }]);
    expect(withImg.hash).not.toBe(without.hash);
    expect(withImg.hash).not.toBe(otherBytes.hash);
  });
});
