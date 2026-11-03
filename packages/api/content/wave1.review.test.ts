import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const drafts: any[] = read('./wave1.translation-drafts.json').drafts;
const rec = read('./wave1.translation-review.json');
const hashOf = (d: any) => createHash('sha256').update(JSON.stringify({ title: d.title, intro: d.intro, ingredients: d.ingredients, steps: d.steps })).digest('hex');

describe('wave1 agent review record', () => {
  it('binds one passing agent review to the exact content of every draft', () => {
    expect(rec.reviews.length).toBe(drafts.length);
    for (const d of drafts) {
      const r = rec.reviews.find((x: any) => x.recipe_id === d.recipe_id && x.country === d.country && x.lang === d.lang);
      expect(r, `${d.recipe_id} ${d.country}/${d.lang}`).toBeTruthy();
      expect(r.content_sha256).toBe(hashOf(d));
      expect(r.reviewer_kind).toBe('agent');
      expect(r.result).toBe('pass');
    }
  });
  it('never claims a human or native review', () => {
    const text = JSON.stringify(rec).toLowerCase();
    expect(rec.reviews.every((r: any) => r.reviewer_kind !== 'human')).toBe(true);
    expect(rec.reviewer).toMatch(/not a human or native-speaker review/);
    expect(text).not.toMatch(/native-reviewed|human-reviewed|kitchen-tested by/);
  });
});
