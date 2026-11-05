/**
 * C2 consent flow - service layer (PREPARATION, disabled by default).
 *
 * Implements the exact write paths proven against design/0007-consent-revisions.sql
 * (REV 9): every live write DERIVES from the snapshot row via json_extract,
 * the revision INSERT is the precondition gate, publish re-runs the full
 * canonical predicate per row flip and consumes its request.
 *
 * GATES (explicit, none claimed here):
 * - The 0007 schema is NOT applied to any live database; these functions
 *   refuse to run when the tables are absent (schemaProbe).
 * - Migration apply requires qualified bounded migration authority.
 * - Publication is admin-authorized: `actor` is an audit identity within an
 *   admin operation; actor RBAC is a module-I launch gate.
 * - All-writer routing, R2 conditional writes, serving-bound reads,
 *   ownerless-catalog opt-in, domain canonical validation, and the pending
 *   withdrawal-policy wording remain open gates.
 * - No route mounts this module yet; when routes land they sit behind
 *   CONSENT_FLOW_ENABLED === 'true' (default off).
 */

import { canonicalSnapshot, type SnapshotInput } from '@2yolks/contracts';

export function consentFlowEnabled(env: { CONSENT_FLOW_ENABLED?: string }): boolean {
  return env.CONSENT_FLOW_ENABLED === 'true';
}

/** True only when the 0007 tables exist. The flow never runs without them. */
export async function schemaProbe(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare(`SELECT count(*) n FROM sqlite_master WHERE type = 'table' AND name IN ('recipe_revisions', 'recipe_consent_events', 'recipe_revision_images', 'publish_requests')`).first<{ n: number }>();
  if (row!.n !== 4) return false;
  // REV 10: consent events carry an explicit text|images scope.
  const cols = await DB.prepare(`SELECT count(*) n FROM pragma_table_info('recipe_consent_events') WHERE name = 'scope'`).first<{ n: number }>();
  if (cols!.n !== 1) return false;
  // REV 11: images carry per-image provenance.
  const prov = await DB.prepare(`SELECT count(*) n FROM pragma_table_info('recipe_images') WHERE name = 'provenance'`).first<{ n: number }>();
  return prov!.n === 1;
}


/** License version pinned to every grant. Bump only with reviewed wording. */
export const PUBLIC_LICENSE_VERSION = 'public-v1';

/** Current revision counter for a recipe (0 when none). Next insert uses +1. */
export async function latestRevisionSeq(DB: D1Database, recipeId: string): Promise<number> {
  const row = await DB.prepare(`SELECT COALESCE(max(seq), 0) AS s FROM recipe_revisions WHERE recipe_id = ?`).bind(recipeId).first<{ s: number }>();
  return row!.s;
}

/** Current consent counter for a recipe (0 when none). Next insert uses +1. */
export async function latestConsentSeq(DB: D1Database, recipeId: string): Promise<number> {
  const row = await DB.prepare(`SELECT COALESCE(max(consent_seq), 0) AS s FROM recipe_consent_events WHERE recipe_id = ?`).bind(recipeId).first<{ s: number }>();
  return row!.s;
}

export type ConsentEvent = { event: 'grant' | 'revoke'; revisionId: string; licenseVersion: string; licenseLang: string; scope: 'text' | 'images'; createdAt: string };
/** The latest consent event per scope decides the current permission state. */
export async function latestConsent(DB: D1Database, recipeId: string, scope: 'text' | 'images' = 'text'): Promise<ConsentEvent | null> {
  const row = await DB.prepare(`SELECT event, revision_id, license_version, license_lang, scope, created_at FROM recipe_consent_events WHERE recipe_id = ? AND scope = ? ORDER BY consent_seq DESC LIMIT 1`).bind(recipeId, scope).first<{ event: 'grant' | 'revoke'; revision_id: string; license_version: string; license_lang: string; scope: 'text' | 'images'; created_at: string }>();
  return row ? { event: row.event, revisionId: row.revision_id, licenseVersion: row.license_version, licenseLang: row.license_lang, scope: row.scope, createdAt: row.created_at } : null;
}

export type WriteResult = { ok: true } | { ok: false; reason: string };

/** Build the canonical snapshot for a recipe from live rows. */
export async function buildSnapshotFromLive(DB: D1Database, recipeId: string): Promise<{ json: string; hash: string } | null> {
  const r = await DB.prepare(`SELECT origin_country, category, prep_minutes, cook_minutes, rest_minutes, total_minutes, base_servings, author_name FROM recipes WHERE id = ?`).bind(recipeId).first<Record<string, unknown>>();
  if (!r) return null;
  const src = await DB.prepare(`SELECT s.name, s.url, s.license FROM sources s JOIN recipes o ON o.source_id = s.id WHERE o.id = ?`).bind(recipeId).first<{ name: string; url: string; license: string }>();
  if (!src) return null;
  const localeRows = await DB.prepare(`SELECT country, lang, title, slug, intro, ingredients_json, steps_json FROM recipe_locales WHERE recipe_id = ? AND status <> 'rejected'`).bind(recipeId).all<Record<string, unknown>>();
  const locales: SnapshotInput['locales'] = {};
  for (const l of localeRows.results ?? []) {
    locales[`${l['country']}:${l['lang']}`] = {
      title: String(l['title']), slug: String(l['slug']), intro: (l['intro'] as string | null) ?? null,
      ingredients: JSON.parse(String(l['ingredients_json'])) as string[], steps: JSON.parse(String(l['steps_json'])) as string[],
    };
  }
  const imageRows = await DB.prepare(`SELECT id, kind, step_index, style, source_name, source_url, license FROM recipe_images WHERE recipe_id = ? ORDER BY id`).bind(recipeId).all<Record<string, unknown>>();
  const images: SnapshotInput['images'] = (imageRows.results ?? []).map((i) => ({
    image_id: String(i['id']), role: i['kind'] === 'hero' ? 'hero' as const : 'step' as const,
    step_index: (i['step_index'] as number | null) ?? null,
    style: String(i['style']) as 'photo' | 'illustration' | 'graphic',
    source_name: String(i['source_name']), source_url: String(i['source_url']), license: String(i['license']),
    // sha256 of the exact R2 bytes is filled by the image pipeline at bind
    // time; a placeholder is never published (digest CHECK + manifest guard).
    sha256: String((i as Record<string, unknown>)['sha256'] ?? ''),
  }));
  return canonicalSnapshot({
    recipe: {
      author_name: (r['author_name'] as string | null) ?? null, base_servings: (r['base_servings'] as number | null) ?? null,
      category: (r['category'] as string | null) ?? null, cook_minutes: (r['cook_minutes'] as number | null) ?? null,
      origin_country: (r['origin_country'] as string | null) ?? null, prep_minutes: (r['prep_minutes'] as number | null) ?? null,
      rest_minutes: (r['rest_minutes'] as number | null) ?? null, total_minutes: (r['total_minutes'] as number | null) ?? null,
    },
    source: src,
    locales,
    images,
  });
}

/**
 * Save an edit as a new immutable revision. The revision INSERT is the
 * precondition gate (stale head, non-owner, submitted or published recipe
 * abort inside the transaction and roll the whole batch back). Every live
 * write derives from the snapshot row via json_extract.
 */
export async function saveRevision(DB: D1Database, recipeId: string, userId: string, revisionId: string, expectedSeq: number, snap: { json: string; hash: string }): Promise<WriteResult> {
  const keys = Object.keys((JSON.parse(snap.json) as { locales: Record<string, unknown> }).locales);
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO recipe_revisions (id, recipe_id, seq, content_hash, snapshot_json, created_by) VALUES (?, ?, ?, ?, ?, ?)`).bind(revisionId, recipeId, expectedSeq + 1, snap.hash, snap.json, userId),
      DB.prepare(`UPDATE recipes SET
        origin_country = r.origin_country, category = r.category, prep_minutes = r.prep_minutes, cook_minutes = r.cook_minutes,
        rest_minutes = r.rest_minutes, total_minutes = r.total_minutes, base_servings = r.base_servings, author_name = r.author_name
        FROM (SELECT json_extract(snapshot_json,'$.recipe.origin_country') AS origin_country, json_extract(snapshot_json,'$.recipe.category') AS category,
          json_extract(snapshot_json,'$.recipe.prep_minutes') AS prep_minutes, json_extract(snapshot_json,'$.recipe.cook_minutes') AS cook_minutes,
          json_extract(snapshot_json,'$.recipe.rest_minutes') AS rest_minutes, json_extract(snapshot_json,'$.recipe.total_minutes') AS total_minutes,
          json_extract(snapshot_json,'$.recipe.base_servings') AS base_servings, json_extract(snapshot_json,'$.recipe.author_name') AS author_name
          FROM recipe_revisions WHERE id = ?) r
        WHERE recipes.id = ?`).bind(revisionId, recipeId),
      DB.prepare(`UPDATE sources SET name = s.name, url = s.url, license = s.license
        FROM (SELECT json_extract(snapshot_json,'$.source.name') AS name, json_extract(snapshot_json,'$.source.url') AS url, json_extract(snapshot_json,'$.source.license') AS license FROM recipe_revisions WHERE id = ?) s
        WHERE sources.id = (SELECT source_id FROM recipes WHERE id = ?)`).bind(revisionId, recipeId),
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
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }; // trigger abort: batch rolled back; caller maps to 409
  }
}

/** Grant or revoke consent for an exact revision + license tuple. */
export async function recordConsent(DB: D1Database, recipeId: string, input: { id: string; revisionId: string; expectedSeq: number; event: 'grant' | 'revoke'; userId: string; licenseVersion: string; licenseLang: string; scope?: 'text' | 'images' }): Promise<WriteResult> {
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO recipe_consent_events (id, recipe_id, revision_id, consent_seq, event, user_id, audience, license_version, license_lang, scope) VALUES (?, ?, ?, ?, ?, ?, 'public', ?, ?, ?)`)
        .bind(input.id, recipeId, input.revisionId, input.expectedSeq + 1, input.event, input.userId, input.licenseVersion, input.licenseLang, input.scope ?? 'text'),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Publish the consented locales of a revision (admin-authorized operation at
 * integration; `actor` is an audit identity). One atomic batch: the request
 * row's assert trigger validates the full precondition set, each flip
 * re-runs the full canonical predicate per row, and the final statement
 * consumes the request.
 */
export async function publishRevision(DB: D1Database, recipeId: string, revisionId: string, actor: string, licenseVersion: string, licenseLang: string, requestId: string): Promise<WriteResult> {
  const rev = await DB.prepare(`SELECT snapshot_json AS s FROM recipe_revisions WHERE id = ? AND recipe_id = ?`).bind(revisionId, recipeId).first<{ s: string }>();
  if (!rev) return { ok: false, reason: 'unknown revision' };
  const keys = Object.keys((JSON.parse(rev.s) as { locales: Record<string, unknown> }).locales);
  try {
    await DB.batch([
      DB.prepare(`INSERT INTO publish_requests (id, recipe_id, revision_id, requested_by, license_version, license_lang) VALUES (?, ?, ?, ?, ?, ?)`).bind(requestId, recipeId, revisionId, actor, licenseVersion, licenseLang),
      ...keys.map((k) => {
        const [country, lang] = k.split(':');
        return DB.prepare(`UPDATE recipe_locales SET status = 'published' WHERE recipe_id = ? AND country = ? AND lang = ? AND status <> 'published'`).bind(recipeId, country, lang);
      }),
      DB.prepare(`UPDATE publish_requests SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL`).bind(requestId),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Moderation disable: unpublish every locale (allowed transition; history retained). */
export async function disableRecipe(DB: D1Database, recipeId: string): Promise<WriteResult> {
  try {
    await DB.prepare(`UPDATE recipe_locales SET status = 'draft' WHERE recipe_id = ? AND status = 'published'`).bind(recipeId).run();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
