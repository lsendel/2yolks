// Generates guarded D1 SQL for the 10 wave-1 translation drafts.
//   node scripts/translation-sql.mjs insert     hidden draft rows (status 'draft', not routable, not in sitemap)
//   node scripts/translation-sql.mjs publish    publish rows whose stored content still matches the review record
//   node scripts/translation-sql.mjs unpublish  recovery: back to 'draft' (never deletes)
//   node scripts/translation-sql.mjs hashes     print content hashes (used by the review-record test)
// Publication stamps reviewer_kind='agent' only from wave1.translation-review.json, which binds a completed
// review to each draft's exact content hash. It is never accepted from a caller or inferred from a key.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = (f) => JSON.parse(readFileSync(new URL(`../packages/api/content/${f}`, import.meta.url), 'utf8'));
const drafts = read('wave1.translation-drafts.json').drafts;
export const hashOf = (d) => createHash('sha256').update(JSON.stringify({ title: d.title, intro: d.intro, ingredients: d.ingredients, steps: d.steps })).digest('hex');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const key = (d) => `${d.recipe_id} ${d.country}/${d.lang}`;
const mode = process.argv[2];
if (mode === 'hashes') {
  for (const d of drafts) console.log(key(d), hashOf(d));
} else if (mode === 'insert') {
  const out = ['-- 2yolks: hidden translation drafts (status draft). Guarded: the original must exist, be published and be an original (translation_of NULL).'];
  for (const d of drafts) {
    const of = `${d.translation_of.country}/${d.translation_of.lang}`;
    const [oc, ol] = of.split('/');
    out.push(
      `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status, translation_of, translation_method) SELECT ${q(d.recipe_id)}, ${q(d.country)}, ${q(d.lang)}, ${q(d.title)}, ${q(d.slug)}, ${q(d.intro)}, ${q(JSON.stringify(d.ingredients))}, ${q(JSON.stringify(d.steps))}, 'draft', ${q(of)}, 'machine' WHERE EXISTS (SELECT 1 FROM recipe_locales WHERE recipe_id=${q(d.recipe_id)} AND country=${q(oc)} AND lang=${q(ol)} AND status='published' AND translation_of IS NULL) AND NOT EXISTS (SELECT 1 FROM recipe_locales WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)});`,
      `INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES ('implementation-agent', 'admin', 'manual.translation_insert', ${q(d.recipe_id)}, ${q(JSON.stringify({ locale: `${d.country}/${d.lang}`, translation_of: of, content_sha256: hashOf(d), status: 'draft' }))});`,
    );
  }
  console.log(out.join('\n'));
} else if (mode === 'publish') {
  const rec = read('wave1.translation-review.json');
  const out = ['-- 2yolks: publish reviewed machine translations. Each UPDATE is a no-op unless the row is a draft with the expected provenance.'];
  for (const d of drafts) {
    const r = rec.reviews.find((x) => x.recipe_id === d.recipe_id && x.country === d.country && x.lang === d.lang);
    if (!r || r.content_sha256 !== hashOf(d) || r.reviewer_kind !== 'agent' || r.result !== 'pass') throw new Error(`no matching passing review for ${key(d)}`);
    const of = `${d.translation_of.country}/${d.translation_of.lang}`;
    out.push(
      `UPDATE recipe_locales SET status='published', translation_reviewed_at=datetime('now'), translation_reviewed_by=${q(rec.reviewer)}, translation_reviewer_kind='agent' WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)} AND status='draft' AND translation_of=${q(of)} AND translation_method='machine' AND ingredients_json=${q(JSON.stringify(d.ingredients))} AND steps_json=${q(JSON.stringify(d.steps))} AND title=${q(d.title)};`,
      `INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES ('implementation-agent', 'admin', 'manual.translation_publish', ${q(d.recipe_id)}, ${q(JSON.stringify({ locale: `${d.country}/${d.lang}`, content_sha256: hashOf(d), reviewer_kind: 'agent', reviewer: rec.reviewer, review_record: 'packages/api/content/wave1.translation-review.json' }))});`,
    );
  }
  console.log(out.join('\n'));
} else if (mode === 'unpublish') {
  const out = ['-- 2yolks: recovery. Returns translated locales to draft; deletes nothing.'];
  for (const d of drafts) {
    out.push(
      `UPDATE recipe_locales SET status='draft' WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)} AND translation_of IS NOT NULL AND status='published';`,
      `INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) VALUES ('implementation-agent', 'admin', 'manual.translation_unpublish', ${q(d.recipe_id)}, ${q(JSON.stringify({ locale: `${d.country}/${d.lang}` }))});`,
    );
  }
  console.log(out.join('\n'));
} else {
  console.error('usage: translation-sql.mjs insert|publish|unpublish|hashes');
  process.exit(2);
}
