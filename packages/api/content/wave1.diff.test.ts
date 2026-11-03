import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderIngredient, unitInfo } from '@2yolks/contracts';

// Prepared structured diff: every proposed row must render back to its source
// text in its own unit system (round trip), and nothing held is proposed.
const diff = JSON.parse(readFileSync(new URL('./wave1.structured-diff.json', import.meta.url), 'utf8'));
const norm = (x: string) => x.replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/\s+/g, ' ').toLowerCase();
describe('prepared structured diff', () => {
  it('48 convert rows round-trip to the source text', () => {
    let n = 0;
    for (const r of diff.recipes) for (const c of r.convert) {
      const sys = ((c.after.unit && unitInfo(c.after.unit)?.system) ?? 'metric') as 'us' | 'metric';
      expect(norm(renderIngredient(c.after, r.lang, sys)), `${r.id}: ${c.before}`).toBe(norm(c.before));
      n++;
    }
    expect(n).toBe(48);
  });
  it('holds are listed with reasons and never overlap convert rows', () => {
    for (const r of diff.recipes) {
      const conv = new Set(r.convert.map((c: any) => c.before));
      for (const h of r.hold) { expect(h.reason).toBeTruthy(); expect(conv.has(h.row)).toBe(false); }
    }
    expect(diff.counts).toEqual({ convert: 48, hold_dual: 6, hold_step_quote: 8, hold_unparsed: 15 });
  });
});
