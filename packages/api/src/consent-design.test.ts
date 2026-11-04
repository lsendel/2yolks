// Executable evidence for design/0007-consent-revisions.sql (REV 8):
// schema validity under enforced FKs, trigger-abort preconditions (real
// batch rollback - no false return after mutation), exact-head CAS,
// snapshot-derived writes, atomic multi-locale publish, sealed manifests.
// Single synchronous connection: these are stale-state and rollback proofs,
// not true-concurrency proofs. Design harness - not wired into testd1/deploy.
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { makeD1 } from './testd1';

let sqlite: DatabaseSync;
let DB: D1Database;

const USER = 'user-1';
const RECIPE = 'rec-1';
const HEX = (c: string) => c.repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a');

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

interface SnapLocale { title: string; slug: string; intro: string | null; ingredients: string[]; steps: string[] }
interface SnapImage { image_id: string; role: string; step_index: number | null; style: string; source_name: string; source_url: string; license: string; sha256: string }
interface SnapRecipe { origin_country: string | null; category: string | null; prep_minutes: number | null; cook_minutes: number | null; rest_minutes: number | null; total_minutes: number | null; base_servings: number | null; author_name: string | null }

// Canonical serialization: alphabetical key order, verbatim strings - no
// normalization. Two texts differing only in whitespace hash differently.
// The manifest covers recipe fields, source rights metadata, every locale
// row keyed "country:lang", and the image manifest.
function canonicalSnapshot(input: { recipe: SnapRecipe; source: { name: string; url: string; license: string }; locales: Record<string, SnapLocale>; images: SnapImage[] }) {
  const locales: Record<string, unknown> = {};
  for (const k of Object.keys(input.locales).sort()) {
    const l = input.locales[k]!;
    locales[k] = { ingredients_json: JSON.stringify(l.ingredients), intro: l.intro, slug: l.slug, steps_json: JSON.stringify(l.steps), title: l.title };
  }
  const images = [...input.images].sort((a, b) => a.image_id.localeCompare(b.image_id)).map((i) => ({ image_id: i.image_id, license: i.license, role: i.role, sha256: i.sha256, source_name: i.source_name, source_url: i.source_url, step_index: i.step_index, style: i.style }));
  const r = input.recipe;
  const json = JSON.stringify({
    images,
    locales,
    recipe: { author_name: r.author_name, base_servings: r.base_servings, category: r.category, cook_minutes: r.cook_minutes, origin_country: r.origin_country, prep_minutes: r.prep_minutes, rest_minutes: r.rest_minutes, total_minutes: r.total_minutes },
    source: { license: input.source.license, name: input.source.name, url: input.source.url },
  });
  return { json, hash: sha(json) };
}

const baseRecipe: SnapRecipe = { origin_country: 'us', category: null, prep_minutes: null, cook_minutes: null, rest_minutes: null, total_minutes: null, base_servings: null, author_name: null };
const baseSource = { name: 'Ana', url: 'https://2yolks.com/', license: 'user-original' };
const enLocale = (title: string, ingredients = ['1 egg'], steps = ['Cook.'], intro: string | null = null): SnapLocale => ({ title, slug: 'soup-x', intro, ingredients, steps });
const snap1 = (title: string, extra?: Partial<Parameters<typeof canonicalSnapshot>[0]>) =>
  canonicalSnapshot({ recipe: { ...baseRecipe }, source: { ...baseSource }, locales: { 'us:en': enLocale(title) }, images: [], ...extra });

// saveEdit: the revision INSERT is the precondition gate (trigger aborts on
// stale/future head, non-owner, submitted or published recipe -> the whole
// batch rolls back). Every live write DERIVES from the snapshot row via
// json_extract - no separately bound content.
async function saveEdit(revisionId: string, expectedSeq: number, snap: { json: string; hash: string }) {
  const keys = Object.keys(JSON.parse(snap.json).locales as Record<string, unknown>);
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES (?, '${RECIPE}', ?, ?, ?, '${USER}')`).bind(revisionId, expectedSeq + 1, snap.hash, snap.json),
      DB.prepare(`UPDATE recipes SET
        origin_country = r.origin_country, category = r.category, prep_minutes = r.prep_minutes, cook_minutes = r.cook_minutes,
        rest_minutes = r.rest_minutes, total_minutes = r.total_minutes, base_servings = r.base_servings, author_name = r.author_name
        FROM (SELECT json_extract(snapshot_json,'$.recipe.origin_country') AS origin_country, json_extract(snapshot_json,'$.recipe.category') AS category,
          json_extract(snapshot_json,'$.recipe.prep_minutes') AS prep_minutes, json_extract(snapshot_json,'$.recipe.cook_minutes') AS cook_minutes,
          json_extract(snapshot_json,'$.recipe.rest_minutes') AS rest_minutes, json_extract(snapshot_json,'$.recipe.total_minutes') AS total_minutes,
          json_extract(snapshot_json,'$.recipe.base_servings') AS base_servings, json_extract(snapshot_json,'$.recipe.author_name') AS author_name
          FROM recipe_revisions WHERE id = ?) r
        WHERE recipes.id = '${RECIPE}'`).bind(revisionId),
      DB.prepare(`UPDATE sources SET name = s.name, url = s.url, license = s.license
        FROM (SELECT json_extract(snapshot_json,'$.source.name') AS name, json_extract(snapshot_json,'$.source.url') AS url, json_extract(snapshot_json,'$.source.license') AS license FROM recipe_revisions WHERE id = ?) s
        WHERE sources.id = (SELECT source_id FROM recipes WHERE id = '${RECIPE}')`).bind(revisionId),
      ...keys.map((k) =>
        DB.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status)
          SELECT r.recipe_id, substr(k.key, 1, instr(k.key, ':') - 1), substr(k.key, instr(k.key, ':') + 1),
            json_extract(k.value,'$.title'), json_extract(k.value,'$.slug'), json_extract(k.value,'$.intro'),
            json_extract(k.value,'$.ingredients_json'), json_extract(k.value,'$.steps_json'), 'draft'
          FROM recipe_revisions r, json_each(json_extract(r.snapshot_json, '$.locales')) k
          WHERE r.id = ? AND k.key = ?
          ON CONFLICT(recipe_id, country, lang) DO UPDATE SET
            title = excluded.title, slug = excluded.slug, intro = excluded.intro,
            ingredients_json = excluded.ingredients_json, steps_json = excluded.steps_json`).bind(revisionId, k)),
    ]);
    return true;
  } catch {
    return false; // trigger/constraint abort: the batch rolled back - caller returns 409
  }
}

// Consent grant/revoke: plain insert; the trigger enforces contiguous seq and
// owner identity; the FK binds (revision, recipe). Aborts roll back.
async function consentEvent(id: string, revisionId: string, expectedSeq: number, event: 'grant' | 'revoke', licenseVersion = 'public-license-v1', licenseLang = 'en', userId = USER) {
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang) VALUES (?, '${RECIPE}', ?, ?, ?, ?, 'public', ?, ?)`).bind(id, revisionId, expectedSeq + 1, event, userId, licenseVersion, licenseLang),
    ]);
    return true;
  } catch {
    return false;
  }
}

let pubN = 0;
// Publish: one batch - the request row's assert trigger validates the full
// precondition set BEFORE any status write; each status flip is re-guarded
// per row. Any failure aborts everything (atomic, no partial mutation).
// `actor` is the authenticated requester (the admin review flow at
// integration); the GRANT must come from the current owner.
async function tryPublish(revisionId: string, actor = USER, licenseVersion = 'public-license-v1', licenseLang = 'en') {
  const rev = await DB.prepare(`SELECT snapshot_json AS s FROM recipe_revisions WHERE id = ?`).bind(revisionId).first<{ s: string }>();
  if (!rev) return false;
  const keys = Object.keys(JSON.parse(rev.s).locales as Record<string, unknown>);
  const pubId = `pub-${++pubN}`;
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES (?, '${RECIPE}', ?, ?, ?, ?)`).bind(pubId, revisionId, actor, licenseVersion, licenseLang),
      ...keys.map((k) => {
        const [country, lang] = k.split(':');
        return DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}' AND country = ? AND lang = ? AND status <> 'published'`).bind(country, lang);
      }),
      // one-use: the request is consumed by its own transition batch, so a
      // historical request can never bless a later flip.
      DB.prepare(`UPDATE publish_requests SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL`).bind(pubId),
    ]);
    return true;
  } catch {
    return false;
  }
}

const statusOf = async (country = 'us', lang = 'en') =>
  (await DB.prepare(`SELECT status FROM recipe_locales WHERE recipe_id = '${RECIPE}' AND country = ? AND lang = ?`).bind(country, lang).first<{ status: string }>())?.status;
const revCount = async () => (await DB.prepare(`SELECT count(*) n FROM recipe_revisions WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>())!.n;

beforeEach(fresh);

describe('0007 schema', () => {
  it('applies under enforced foreign keys', () => {
    expect(() => sqlite.exec(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-1', '${RECIPE}', 1, '${HEX('a')}', '{"recipe":{"author_name":"A","category":"c","origin_country":"us","prep_minutes":null,"cook_minutes":null,"rest_minutes":null,"total_minutes":null,"base_servings":null},"source":{"name":"A","url":"u","license":"l"},"locales":{},"images":[]}', '${USER}')`)).not.toThrow();
  });
  it('rejects malformed snapshot shape and hash before any row lands', async () => {
    expect(() => sqlite.exec(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-x', '${RECIPE}', 1, 'h', '{"recipe":{"author_name":"A","category":"c","origin_country":"us","prep_minutes":null,"cook_minutes":null,"rest_minutes":null,"total_minutes":null,"base_servings":null},"source":{"name":"A","url":"u","license":"l"},"locales":{},"images":[]}', '${USER}')`)).toThrow(/CHECK/);
    expect(() => sqlite.exec(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-x', '${RECIPE}', 1, '${HEX('a')}', '{"a":1}', '${USER}')`)).toThrow(/CHECK|source|recipe/);
    expect(await revCount()).toBe(0);
  });
  it('rejects a consent event whose revision belongs to another recipe', async () => {
    sqlite.exec(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('rec-2', 'src-1', 'us', '2026-01-01', '${USER}')`);
    sqlite.exec(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-2', 'rec-2', 1, '${HEX('a')}', '{"recipe":{"author_name":"A","category":"c","origin_country":"us","prep_minutes":null,"cook_minutes":null,"rest_minutes":null,"total_minutes":null,"base_servings":null},"source":{"name":"A","url":"u","license":"l"},"locales":{},"images":[]}', '${USER}')`);
    expect(() => sqlite.exec(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang) VALUES ('ce-1', '${RECIPE}', 'rev-2', 1, 'grant', '${USER}', 'public', 'public-license-v1', 'en')`)).toThrow(/FOREIGN KEY/);
    expect(await revCount()).toBe(0);
  });
});

describe('save preconditions abort inside the transaction', () => {
  it('a submitted recipe rejects the edit and NOTHING is written', async () => {
    sqlite.exec(`UPDATE recipes SET submitted_at = '2026-01-02' WHERE id = '${RECIPE}'`);
    expect(await saveEdit('rev-a', 0, snap1('New'))).toBe(false);
    expect(await revCount()).toBe(0);
    const t = await DB.prepare(`SELECT title FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ title: string }>();
    expect(t!.title).toBe('Soup');
  });
  it('a future head (seq gap) aborts even on empty history', async () => {
    expect(await saveEdit('rev-a', 99, snap1('New'))).toBe(false);
    expect(await revCount()).toBe(0);
  });
  it('a non-owner edit aborts', async () => {
    sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('user-2', 'o@example.com', '2026-01-01')`);
    const snap = snap1('New');
    try {
      await DB.batch([DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-a', '${RECIPE}', 1, ?, ?, 'user-2')`).bind(snap.hash, snap.json)]);
      throw new Error('should have aborted');
    } catch (e) {
      expect(String(e)).toMatch(/not editable/);
    }
    expect(await revCount()).toBe(0);
  });
});

describe('constraint-abort CAS (single connection; abort is the rollback proof)', () => {
  it('two saves with the same expected head: exactly one wins, the loser rolls back', async () => {
    const a = await saveEdit('rev-a', 0, snap1('Soup A'));
    const b = await saveEdit('rev-b', 0, snap1('Soup B'));
    expect([a, b].sort()).toEqual([false, true]);
    expect(await revCount()).toBe(1);
  });
  it('same-id replay with different content aborts and leaves prior state untouched', async () => {
    const s1 = snap1('Original');
    expect(await saveEdit('rev-a', 0, s1)).toBe(true);
    expect(await saveEdit('rev-a', 0, snap1('Changed'))).toBe(false);
    const row = await DB.prepare(`SELECT l.title, r.content_hash FROM recipe_locales l JOIN recipe_revisions r ON r.recipe_id = l.recipe_id WHERE l.recipe_id = '${RECIPE}'`).first<{ title: string; content_hash: string }>();
    expect(row!.title).toBe('Original');
    expect(row!.content_hash).toBe(s1.hash);
  });
  it('stale head after a newer revision aborts the whole batch (locale not mutated)', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await saveEdit('rev-b', 1, snap1('Soup v2'))).toBe(true);
    expect(await saveEdit('rev-c', 0, snap1('Stale'))).toBe(false);
    const t = await DB.prepare(`SELECT title FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ title: string }>();
    expect(t!.title).toBe('Soup v2');
    expect(await revCount()).toBe(2);
  });
});

describe('snapshot-derived writes', () => {
  it('locale, recipe and source rows take their values FROM the snapshot', async () => {
    const snap = canonicalSnapshot({
      recipe: { ...baseRecipe, prep_minutes: 10, base_servings: 4, author_name: 'Ana M.', category: 'soups-stews' },
      source: { ...baseSource },
      locales: { 'us:en': enLocale('Derived Title', ['2 cups broth'], ['Simmer.']) },
      images: [],
    });
    expect(await saveEdit('rev-a', 0, snap)).toBe(true);
    const l = await DB.prepare(`SELECT title, ingredients_json FROM recipe_locales WHERE recipe_id = '${RECIPE}'`).first<{ title: string; ingredients_json: string }>();
    expect(l!.title).toBe('Derived Title');
    expect(l!.ingredients_json).toBe('["2 cups broth"]');
    const r = await DB.prepare(`SELECT prep_minutes, base_servings, author_name, category FROM recipes WHERE id = '${RECIPE}'`).first<{ prep_minutes: number; base_servings: number; author_name: string; category: string }>();
    expect(r!).toMatchObject({ prep_minutes: 10, base_servings: 4, author_name: 'Ana M.', category: 'soups-stews' });
  });
});

describe('publish: atomic, content-bound, owner-bound', () => {
  it('publishes with a matching grant on the head revision and bound content', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    expect(await statusOf()).toBe('published');
  });
  it('multi-locale publish flips exactly the consented locales atomically', async () => {
    const snap = snap1('Soup', { locales: { 'mx:es': { title: 'Sopa', slug: 'sopa-x', intro: null, ingredients: ['1 huevo'], steps: ['Cocer.'] }, 'us:en': enLocale('Soup') } });
    expect(await saveEdit('rev-a', 0, snap)).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    expect(await statusOf('us', 'en')).toBe('published');
    expect(await statusOf('mx', 'es')).toBe('published');
  });
  it('an EXTRA live locale outside the snapshot aborts the whole publish - no partial mutation', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    sqlite.exec(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${RECIPE}', 'mx', 'es', 'Sopa sin consentir', 'sopa-y', NULL, '["sin permiso"]', '["X."]', 'draft')`);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf('us', 'en')).toBe('draft');
    expect(await statusOf('mx', 'es')).toBe('draft');
    const pubs = await DB.prepare(`SELECT count(*) n FROM publish_requests`).first<{ n: number }>();
    expect(pubs!.n).toBe(0);
  });
  it('a MISSING live locale for a consented key aborts the publish', async () => {
    const snap = snap1('Soup', { locales: { 'mx:es': { title: 'Sopa', slug: 'sopa-x', intro: null, ingredients: ['1 huevo'], steps: ['Cocer.'] }, 'us:en': enLocale('Soup') } });
    expect(await saveEdit('rev-a', 0, snap)).toBe(true);
    sqlite.exec(`DELETE FROM recipe_locales WHERE recipe_id = '${RECIPE}' AND country = 'mx'`);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf('us', 'en')).toBe('draft');
  });
  it('drifted ingredients (same title) cannot be published - content binding is full', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Consent Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    sqlite.exec(`UPDATE recipe_locales SET ingredients_json = '["2 eggs"]' WHERE recipe_id = '${RECIPE}'`);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
  it('drifted recipe fields (timing/author) cannot be published', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    sqlite.exec(`UPDATE recipes SET prep_minutes = 99 WHERE id = '${RECIPE}'`);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
  it('a grant for revision A never authorizes publishing revision B', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await saveEdit('rev-b', 1, snap1('Soup edited'))).toBe(true);
    expect(await tryPublish('rev-b')).toBe(false);
    expect(await statusOf()).toBe('draft');
    expect(await tryPublish('rev-a')).toBe(false); // no longer head
  });
  it('a live row drifted from the consented snapshot cannot be published', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Consent Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    sqlite.exec(`UPDATE recipe_locales SET title = 'Unconsented title' WHERE recipe_id = '${RECIPE}'`);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
  it('a revoke after the grant blocks publish; a re-grant unblocks it', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await consentEvent('ce-2', 'rev-a', 1, 'revoke')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await consentEvent('ce-3', 'rev-a', 2, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
  });
  it('a grant under different license wording does not satisfy the guard', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant', 'public-license-v1', 'en')).toBe(true);
    expect(await tryPublish('rev-a', USER, 'public-license-v2', 'en')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
  it('publication stays admin-authorized: an admin-side actor identity publishes WITH the owner grant (actor RBAC itself is an out-of-schema module-I gate)', async () => {
    sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('admin-1', 'admin@example.com', '2026-01-01')`);
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a', 'admin-1')).toBe(true);
    expect(await statusOf()).toBe('published');
  });
  it('an ownerless (catalog) recipe cannot enter the consent flow', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    sqlite.exec(`UPDATE recipes SET owner_user_id = NULL WHERE id = '${RECIPE}'`);
    expect(await consentEvent('ce-x', 'rev-a', 0, 'grant')).toBe(false); // NULL owner: IS NOT comparison aborts
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
  it('an ownerless recipe cannot create revisions at all', async () => {
    sqlite.exec(`UPDATE recipes SET owner_user_id = NULL WHERE id = '${RECIPE}'`);
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(false);
    expect(await revCount()).toBe(0);
  });
  it('published content is immutable; a published recipe rejects further edits', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    expect(() => sqlite.exec(`UPDATE recipe_locales SET title = 'Sneaky' WHERE recipe_id = '${RECIPE}'`)).toThrow(/immutable/);
    expect(await saveEdit('rev-b', 1, snap1('Soup v2'))).toBe(false); // published locale blocks new revisions
    expect(await revCount()).toBe(1);
  });
});

describe('consent events', () => {
  it('two consent events with the same expected seq: exactly one wins, the loser aborts', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    const a = await consentEvent('ce-a', 'rev-a', 0, 'grant');
    const b = await consentEvent('ce-b', 'rev-a', 0, 'grant');
    expect([a, b].sort()).toEqual([false, true]);
  });
  it('a future consent seq aborts', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-a', 'rev-a', 41, 'grant')).toBe(false);
  });
  it('a non-owner cannot grant consent (owner guard in the insert trigger)', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    sqlite.exec(`INSERT INTO users (id, email, created_at) VALUES ('user-2', 'other@example.com', '2026-01-01')`);
    expect(await consentEvent('ce-9', 'rev-a', 0, 'grant', 'public-license-v1', 'en', 'user-2')).toBe(false);
    expect(await tryPublish('rev-a', 'user-2')).toBe(false);
  });
});

describe('image manifest coherence and sealing', () => {
  const seedImages = () => {
    sqlite.exec(`INSERT INTO recipes (id, source_id, origin_country, created_at, owner_user_id) VALUES ('rec-2', 'src-1', 'us', '2026-01-01', '${USER}')`);
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/${HEX('a')}.webp', 'image/webp', 100, 'photo', 'Ana', '', 'proprietary', '2026-01-01', '2026-01-01')`);
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-2', 'rec-2', 'hero', 'img/${HEX('b')}.webp', 'image/webp', 100, 'photo', 'Bob', '', 'proprietary', '2026-01-01', '2026-01-01')`);
  };
  const manifestInsert = (imageId: string, sha256 = HEX('a'), role = 'hero') =>
    DB.prepare(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', ?, ?, 'photo', 'Ana', '', 'proprietary', ?)`).bind(imageId, role, sha256).run();
  it('a foreign-recipe image cannot enter the manifest', async () => {
    seedImages();
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    await expect(manifestInsert('img-2')).rejects.toThrow(/another recipe/);
    await expect(manifestInsert('img-1')).resolves.toMatchObject({ meta: expect.objectContaining({ changes: 1 }) });
  });
  it('role must match the image kind; the digest must be 64 lowercase hex', async () => {
    seedImages();
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    await expect(manifestInsert('img-1', HEX('a'), 'step')).rejects.toThrow(/role/);
    await expect(manifestInsert('img-1', 'abc')).rejects.toThrow(/sha256/);
    await expect(manifestInsert('img-1', 'a' + 'z'.repeat(63))).rejects.toThrow(/sha256/); // first char hex is not enough
  });
  it('the manifest is sealed once consent exists', async () => {
    seedImages();
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    await manifestInsert('img-1');
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    await expect(DB.prepare(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', 'img-1', 'hero', 'photo', 'Ana', '', 'proprietary', '${HEX('c')}')`).run()).rejects.toThrow(/sealed|PRIMARY KEY|append-only/);
  });
});

describe('published-state protection (all write paths)', () => {
  const published = async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    expect(await statusOf()).toBe('published');
  };
  it('a direct INSERT with status published aborts', async () => {
    expect(() => sqlite.exec(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${RECIPE}', 'mx', 'es', 'Sopa', 'sopa-x', NULL, '["1 huevo"]', '["Cocer."]', 'published')`)).toThrow(/guarded flow/);
    expect(await statusOf('mx', 'es')).toBeUndefined();
  });
  it('INSERT OR REPLACE cannot overwrite a published row', async () => {
    await published();
    expect(() => sqlite.exec(`INSERT OR REPLACE INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES ('${RECIPE}', 'us', 'en', 'Swapped', 'soup-x', NULL, '["9 x"]', '["Y."]', 'draft')`)).toThrow(/cannot be replaced/);
    const t = await DB.prepare(`SELECT title, status FROM recipe_locales WHERE recipe_id = '${RECIPE}' AND country = 'us'`).first<{ title: string; status: string }>();
    expect(t!).toMatchObject({ title: 'Soup', status: 'published' });
  });
  it('published locale identity (country/lang/recipe) cannot be rewritten', async () => {
    await published();
    expect(() => sqlite.exec(`UPDATE recipe_locales SET country = 'mx', lang = 'es' WHERE recipe_id = '${RECIPE}'`)).toThrow(/immutable/);
    expect(await statusOf()).toBe('published');
  });
  it('bound recipe fields and source metadata cannot change while published', async () => {
    await published();
    expect(() => sqlite.exec(`UPDATE recipes SET author_name = 'Someone Else' WHERE id = '${RECIPE}'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`UPDATE recipes SET prep_minutes = 99 WHERE id = '${RECIPE}'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`UPDATE recipes SET owner_user_id = 'user-2' WHERE id = '${RECIPE}'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`UPDATE sources SET name = 'Other', url = 'https://evil.example/' WHERE id = 'src-1'`)).toThrow(/immutable/);
    // flow/moderation fields stay writable:
    sqlite.exec(`UPDATE recipes SET submitted_at = '2026-01-03' WHERE id = '${RECIPE}'`);
  });
  it('a bound image record is content-immutable; cleared_at stays writable', async () => {
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/${HEX('a')}.webp', 'image/webp', 100, 'photo', 'Ana', '', 'proprietary', NULL, '2026-01-01')`);
    const img: SnapImage = { image_id: 'img-1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: '', license: 'proprietary', sha256: HEX('a') };
    expect(await saveEdit('rev-a', 0, snap1('Soup', { images: [img] }))).toBe(true);
    sqlite.exec(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', 'img-1', 'hero', 'photo', 'Ana', '', 'proprietary', '${HEX('a')}')`);
    expect(() => sqlite.exec(`UPDATE recipe_images SET style = 'illustration' WHERE id = 'img-1'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`UPDATE recipe_images SET license = 'CC0-1.0' WHERE id = 'img-1'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`DELETE FROM recipe_images WHERE id = 'img-1'`)).toThrow(/never deleted/);
    sqlite.exec(`UPDATE recipe_images SET cleared_at = '2026-01-02' WHERE id = 'img-1'`); // moderation stamp allowed
  });
  it('a published locale row is never deleted (disable via status instead)', async () => {
    await published();
    expect(() => sqlite.exec(`DELETE FROM recipe_locales WHERE recipe_id = '${RECIPE}'`)).toThrow(/never deleted/);
    sqlite.exec(`UPDATE recipe_locales SET status = 'rejected' WHERE recipe_id = '${RECIPE}'`); // moderation path allowed
    expect(await statusOf()).toBe('rejected');
  });
});

describe('one-use publication authorization', () => {
  it('a historical (consumed) request cannot bless a republish after disable + metadata drift', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    sqlite.exec(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = '${RECIPE}'`); // moderation disable
    sqlite.exec(`UPDATE recipes SET author_name = 'Unconsented Name', prep_minutes = 99 WHERE id = '${RECIPE}'`); // writable again while unpublished
    expect(() => sqlite.exec(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}'`)).toThrow(/publish guard failed/);
    const served = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(served!.n).toBe(0);
    // and a fresh publish request re-runs the FULL assertion: drift is caught
    expect(await tryPublish('rev-a')).toBe(false);
    expect(await statusOf()).toBe('draft');
  });
});

describe('the full canonical predicate re-runs on EVERY publish flip', () => {
  it('an orphan unconsumed request cannot bless a flip after metadata drift', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    // request committed ALONE (no transition batch, no consume statement)
    await DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES ('pub-orphan', '${RECIPE}', 'rev-a', '${USER}', 'public-license-v1', 'en')`).run();
    sqlite.exec(`UPDATE recipes SET prep_minutes = 999 WHERE id = '${RECIPE}'`); // drift AFTER the request
    expect(() => sqlite.exec(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}'`)).toThrow(/publish guard failed/);
    const served = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(served!.n).toBe(0);
  });
  it('an orphan request whose full predicate still holds authorizes the flip (equivalent to the approved transition)', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    await DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES ('pub-orphan', '${RECIPE}', 'rev-a', '${USER}', 'public-license-v1', 'en')`).run();
    sqlite.exec(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}'`);
    expect(await statusOf()).toBe('published');
  });
  it('same-batch publish -> disable -> drift -> republish fails on the second flip', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    await expect(DB.batch([
      DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES ('pub-x', '${RECIPE}', 'rev-a', '${USER}', 'public-license-v1', 'en')`),
      DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}'`),
      DB.prepare(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = '${RECIPE}'`),
      DB.prepare(`UPDATE recipes SET author_name = 'Drifted' WHERE id = '${RECIPE}'`),
      DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = '${RECIPE}'`),
      DB.prepare(`UPDATE publish_requests SET consumed_at = datetime('now') WHERE id = 'pub-x' AND consumed_at IS NULL`),
    ])).rejects.toThrow(/publish guard failed|immutable/);
    expect(await statusOf()).toBe('draft');
    const reqs = await DB.prepare(`SELECT count(*) n FROM publish_requests`).first<{ n: number }>();
    expect(reqs!.n).toBe(0); // whole batch rolled back
  });
});

describe('INSERT OR REPLACE / upsert replay is closed', () => {
  it('append-only tables reject REPLACE collisions', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    const snap = snap1('Replay');
    expect(() => sqlite.exec(`INSERT OR REPLACE INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES ('rev-a', '${RECIPE}', 2, '${snap.hash}', '${snap.json.replace(/'/g, "''")}', '${USER}')`)).toThrow(/append-only/);
    expect(() => sqlite.exec(`INSERT OR REPLACE INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang) VALUES ('ce-1', '${RECIPE}', 'rev-a', 1, 'revoke', '${USER}', 'public', 'public-license-v1', 'en')`)).toThrow(/append-only/);
    const stillGrant = await DB.prepare(`SELECT event FROM recipe_consent_events WHERE id = 'ce-1'`).first<{ event: string }>();
    expect(stillGrant!.event).toBe('grant');
  });
  it('a bound image id cannot be replaced, re-keyed or re-owned', async () => {
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/${HEX('a')}.webp', 'image/webp', 100, 'photo', 'Ana', '', 'proprietary', '2026-01-01', '2026-01-01')`);
    const img: SnapImage = { image_id: 'img-1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: '', license: 'proprietary', sha256: HEX('a') };
    expect(await saveEdit('rev-a', 0, snap1('Soup', { images: [img] }))).toBe(true);
    sqlite.exec(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', 'img-1', 'hero', 'photo', 'Ana', '', 'proprietary', '${HEX('a')}')`);
    expect(() => sqlite.exec(`UPDATE recipe_images SET recipe_id = 'rec-9' WHERE id = 'img-1'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`UPDATE recipe_images SET id = 'img-9' WHERE id = 'img-1'`)).toThrow(/immutable/);
    expect(() => sqlite.exec(`INSERT OR REPLACE INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/${HEX('b')}.webp', 'image/webp', 100, 'illustration', 'Ana', '', 'proprietary', '2026-01-01', '2026-01-01')`)).toThrow(/cannot be replaced|never deleted|append-only/);
    const row = await DB.prepare(`SELECT style FROM recipe_images WHERE id = 'img-1'`).first<{ style: string }>();
    expect(row!.style).toBe('photo');
  });
});

describe('recursive snapshot validation at insert', () => {
  const rawRevision = (id: string, snapJson: string, seq = 1) => {
    const hash = createHash('sha256').update(snapJson, 'utf8').digest('hex');
    return DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES (?, '${RECIPE}', ?, ?, ?, '${USER}')`).bind(id, seq, hash, snapJson).run();
  };
  it('a source object missing required keys is rejected (no NULL-equal publish bypass)', async () => {
    const good = JSON.parse(snap1('Soup').json);
    const bad = JSON.stringify({ ...good, source: {} });
    await expect(rawRevision('rev-bad', bad)).rejects.toThrow(/source/);
    expect(await revCount()).toBe(0);
  });
  it('a locale missing steps_json or with the wrong types is rejected', async () => {
    const good = JSON.parse(snap1('Soup').json);
    const missing = { ...good, locales: { 'us:en': { title: 'Soup', slug: 'soup-x', intro: null, ingredients_json: '["1 egg"]' } } };
    await expect(rawRevision('rev-bad', JSON.stringify(missing))).rejects.toThrow(/locale/);
    const wrongType = { ...good, locales: { 'us:en': { title: 'Soup', slug: 'soup-x', intro: null, ingredients_json: '["1 egg"]', steps_json: 42 } } };
    await expect(rawRevision('rev-bad', JSON.stringify(wrongType))).rejects.toThrow(/locale/);
    const badKey = { ...good, locales: { usen: { title: 'Soup', slug: 'soup-x', intro: null, ingredients_json: '["1 egg"]', steps_json: '["Cook."]' } } };
    await expect(rawRevision('rev-bad', JSON.stringify(badKey))).rejects.toThrow(/locale/);
    expect(await revCount()).toBe(0);
  });
  it('malformed locale identities and non-array ingredient/step payloads are rejected', async () => {
    const good = JSON.parse(snap1('Soup').json);
    const loc = (key: string, ing: unknown = '["1 egg"]', st: unknown = '["Cook."]') => ({ ...good, locales: { [key]: { title: 'Soup', slug: 'soup-x', intro: null, ingredients_json: ing, steps_json: st } } });
    await expect(rawRevision('rev-bad', JSON.stringify(loc('u:en')))).rejects.toThrow(/locale/);
    await expect(rawRevision('rev-bad', JSON.stringify(loc('us:en:x')))).rejects.toThrow(/locale/);
    await expect(rawRevision('rev-bad', JSON.stringify(loc('us:en', 'not json at all')))).rejects.toThrow(/locale/);
    await expect(rawRevision('rev-bad', JSON.stringify(loc('us:en', '"just a string"')))).rejects.toThrow(/locale/);
    await expect(rawRevision('rev-bad', JSON.stringify(loc('us:en', '["1 egg"]', '{"not":"array"}')))).rejects.toThrow(/locale/);
    expect(await revCount()).toBe(0);
  });
  it('a snapshot recipe object missing required keys or with wrong types is rejected', async () => {
    const good = JSON.parse(snap1('Soup').json);
    await expect(rawRevision('rev-bad', JSON.stringify({ ...good, recipe: {} }))).rejects.toThrow(/recipe/);
    const wrongType = { ...good, recipe: { ...good.recipe, prep_minutes: 'ten' } };
    await expect(rawRevision('rev-bad', JSON.stringify(wrongType))).rejects.toThrow(/recipe/);
    expect(await revCount()).toBe(0);
  });
});

describe('serving consults current consent', () => {
  it('a revoke after publish removes the row from the serving view immediately', async () => {
    expect(await saveEdit('rev-a', 0, snap1('Soup'))).toBe(true);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    const served = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(served!.n).toBe(1);
    expect(await consentEvent('ce-2', 'rev-a', 1, 'revoke')).toBe(true);
    const after = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(after!.n).toBe(0); // serving stops; status stays 'published' as audit
    expect(await statusOf()).toBe('published');
    expect(await consentEvent('ce-3', 'rev-a', 2, 'grant')).toBe(true);
    const restored = await DB.prepare(`SELECT count(*) n FROM recipe_locales_effective WHERE recipe_id = '${RECIPE}'`).first<{ n: number }>();
    expect(restored!.n).toBe(1);
  });
});

describe('append-only enforcement', () => {
  it('revisions, manifests, consent events and publish requests reject UPDATE/DELETE', async () => {
    sqlite.exec(`INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES ('img-1', '${RECIPE}', 'hero', 'img/${HEX('a')}.webp', 'image/webp', 100, 'photo', 'Ana', '', 'proprietary', '2026-01-01', '2026-01-01')`);
    const img: SnapImage = { image_id: 'img-1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: '', license: 'proprietary', sha256: HEX('a') };
    expect(await saveEdit('rev-a', 0, snap1('Soup', { images: [img] }))).toBe(true);
    sqlite.exec(`INSERT INTO recipe_revision_images (revision_id, image_id, role, style, source_name, source_url, license, sha256) VALUES ('rev-a', 'img-1', 'hero', 'photo', 'Ana', '', 'proprietary', '${HEX('a')}')`);
    expect(await consentEvent('ce-1', 'rev-a', 0, 'grant')).toBe(true);
    expect(await tryPublish('rev-a')).toBe(true);
    await expect(DB.prepare(`UPDATE recipe_revisions SET content_hash = 'x' WHERE id = 'rev-a'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_revisions WHERE id = 'rev-a'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`UPDATE recipe_consent_events SET license_version = 'v9' WHERE id = 'ce-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_consent_events WHERE id = 'ce-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`UPDATE recipe_revision_images SET sha256 = '${HEX('d')}' WHERE image_id = 'img-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`DELETE FROM recipe_revision_images WHERE image_id = 'img-1'`).run()).rejects.toThrow(/append-only/);
    await expect(DB.prepare(`UPDATE publish_requests SET requested_by = 'x'`).run()).rejects.toThrow(/consumption/);
    await expect(DB.prepare(`DELETE FROM publish_requests`).run()).rejects.toThrow(/append-only/);
  });
});

describe('canonical hashing', () => {
  it('whitespace-only text changes produce a different hash (verbatim snapshot)', () => {
    const a = snap1('Soup', { locales: { 'us:en': enLocale('Soup', ['1 egg'], ['Cook.'], 'Warm.') } });
    const b = snap1('Soup', { locales: { 'us:en': enLocale('Soup', ['1 egg'], ['Cook.'], 'Warm. ') } });
    expect(a.hash).not.toBe(b.hash);
  });
  it('the image manifest participates in the hash', () => {
    const img: SnapImage = { image_id: 'img-1', role: 'hero', step_index: null, style: 'photo', source_name: 'Ana', source_url: '', license: 'proprietary', sha256: HEX('a') };
    expect(snap1('Soup', { images: [img] }).hash).not.toBe(snap1('Soup').hash);
    expect(snap1('Soup', { images: [img] }).hash).not.toBe(snap1('Soup', { images: [{ ...img, sha256: HEX('b') }] }).hash);
  });
});
