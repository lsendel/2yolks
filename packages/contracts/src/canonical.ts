/**
 * Canonical revision snapshots (C2 consent flow, design 0007).
 *
 * A snapshot is the exact content a consent event binds: recipe fields,
 * source rights metadata, every locale row keyed "country:lang", and the
 * image manifest. Serialization is canonical: alphabetical key order,
 * verbatim strings, no normalization. Two texts differing only in
 * whitespace hash differently. Keep this byte-compatible with
 * design/0007-consent-revisions.sql tests.
 */

export interface SnapRecipe {
  author_name: string | null;
  base_servings: number | null;
  category: string | null;
  cook_minutes: number | null;
  origin_country: string | null;
  prep_minutes: number | null;
  rest_minutes: number | null;
  total_minutes: number | null;
}
export interface SnapSource { name: string; url: string; license: string }
export interface SnapLocale { title: string; slug: string; intro: string | null; ingredients: string[]; steps: string[] }
export interface SnapImage {
  image_id: string; role: 'hero' | 'step'; step_index: number | null;
  style: 'photo' | 'illustration' | 'graphic';
  source_name: string; source_url: string; license: string; sha256: string;
  /** Declared origin (design 0009): consent binds it through the hash. */
  provenance: 'own' | 'ai' | 'other' | null;
  provenance_note: string | null;
}
export interface SnapshotInput {
  recipe: SnapRecipe;
  source: SnapSource;
  locales: Record<string, SnapLocale>;
  images: SnapImage[];
}

/** Canonical JSON for a snapshot. Keys are emitted in alphabetical order at every level. */
export function canonicalSnapshotJson(input: SnapshotInput): string {
  const locales: Record<string, unknown> = {};
  for (const k of Object.keys(input.locales).sort()) {
    const l = input.locales[k]!;
    locales[k] = { ingredients_json: JSON.stringify(l.ingredients), intro: l.intro, slug: l.slug, steps_json: JSON.stringify(l.steps), title: l.title };
  }
  const images = [...input.images].sort((a, b) => a.image_id.localeCompare(b.image_id)).map((i) => ({
    image_id: i.image_id, license: i.license, provenance: i.provenance, provenance_note: i.provenance_note, role: i.role, sha256: i.sha256,
    source_name: i.source_name, source_url: i.source_url, step_index: i.step_index, style: i.style,
  }));
  const r = input.recipe;
  return JSON.stringify({
    images,
    locales,
    recipe: {
      author_name: r.author_name, base_servings: r.base_servings, category: r.category, cook_minutes: r.cook_minutes,
      origin_country: r.origin_country, prep_minutes: r.prep_minutes, rest_minutes: r.rest_minutes, total_minutes: r.total_minutes,
    },
    source: { license: input.source.license, name: input.source.name, url: input.source.url },
  });
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function canonicalSnapshot(input: SnapshotInput): Promise<{ json: string; hash: string }> {
  const json = canonicalSnapshotJson(input);
  return { json, hash: await sha256Hex(json) };
}
