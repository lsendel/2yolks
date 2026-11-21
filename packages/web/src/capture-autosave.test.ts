import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS, CAPTURE_HELPERS_JS } from './clientScript';

type Helpers = {
  mergeIngredientLine: (text: string, answer: string, target?: string) => string;
  captureDecide: (saved: unknown, current: Record<string, string>, names: string[], now: number, maxAgeMs: number) => 'none' | 'restore' | 'offer';
};
const H = new Function(`${CAPTURE_HELPERS_JS}; return { mergeIngredientLine: mergeIngredientLine, captureDecide: captureDecide };`)() as Helpers;

describe('capture script source', () => {
  it('compiles as plain browser JS (template escaping is intact)', () => {
    expect(() => new Function(CAPTURE_CLIENT_SCRIPT)).not.toThrow();
  });
  it('ships autosave strings in en/es/fr', () => {
    const all = JSON.parse(CAPTURE_CHECK_STRINGS) as Record<string, Record<string, string>>;
    for (const lang of ['en', 'es', 'fr']) for (const k of ['restored', 'unsaved', 'restore', 'discard']) expect(all[lang]![k], `${lang}.${k}`).toBeTruthy();
    expect(all['en']!['cups_todo']).toBe('You use "cup" - cups vary by country, so consider grams or ml too');
  });
});

describe('quick-choice ingredient merge (no duplicates)', () => {
  it('replaces the bare line named by the question target', () => {
    expect(H.mergeIngredientLine('200 g flour\nsalt\n2 eggs', '1 tsp salt', 'salt')).toBe('200 g flour\n1 tsp salt\n2 eggs');
  });
  it('without a target, replaces the line for the same ingredient (amount/unit/notes ignored)', () => {
    expect(H.mergeIngredientLine('200 g flour\nSalt, to taste', '1 tsp salt')).toBe('200 g flour\n1 tsp salt');
    expect(H.mergeIngredientLine('2 eggs\n100 ml milk', '3 eggs')).toBe('3 eggs\n100 ml milk');
    expect(H.mergeIngredientLine('1 cucharadita de sal\nharina', '½ cucharadita de sal')).toBe('½ cucharadita de sal\nharina');
    expect(H.mergeIngredientLine('beurre\n2 œufs', '30 g beurre')).toBe('30 g beurre\n2 œufs');
  });
  it('appends when the ingredient is new, and handles an empty list', () => {
    expect(H.mergeIngredientLine('200 g flour', '1 tsp fine sea salt')).toBe('200 g flour\n1 tsp fine sea salt');
    expect(H.mergeIngredientLine('', '1 tsp salt')).toBe('1 tsp salt');
    expect(H.mergeIngredientLine('200 g flour\n', '1 tsp salt')).toBe('200 g flour\n1 tsp salt');
  });
  it('a different ingredient that merely contains the word is not replaced', () => {
    expect(H.mergeIngredientLine('1 tsp kosher salt', '1 tsp salt')).toBe('1 tsp kosher salt\n1 tsp salt');
  });
});

describe('autosave restore decision', () => {
  const names = ['title', 'intro', 'ingredients', 'steps', 'locale'];
  const blank = { title: '', intro: '', ingredients: '', steps: '', locale: 'us:en' };
  const typed = { title: 'Soup', intro: '', ingredients: '1 onion', steps: 'Chop.', locale: 'us:en' };
  const now = 1_000_000_000;
  const DAY = 86_400_000;
  it('restores into a blank form, offers on a filled one, ignores equal/blank/stale/malformed copies', () => {
    expect(H.captureDecide({ v: 1, at: now - 1000, f: typed }, blank, names, now, 30 * DAY)).toBe('restore');
    expect(H.captureDecide({ v: 1, at: now - 1000, f: typed }, { ...typed, title: 'Other' }, names, now, 30 * DAY)).toBe('offer');
    expect(H.captureDecide({ v: 1, at: now - 1000, f: { ...typed, title: ' Soup ' } }, typed, names, now, 30 * DAY)).toBe('none');
    expect(H.captureDecide({ v: 1, at: now - 1000, f: blank }, typed, names, now, 30 * DAY)).toBe('none');
    expect(H.captureDecide({ v: 1, at: now - 31 * DAY, f: typed }, blank, names, now, 30 * DAY)).toBe('none');
    expect(H.captureDecide(null, blank, names, now, 30 * DAY)).toBe('none');
    expect(H.captureDecide({ f: typed }, blank, names, now, 30 * DAY)).toBe('none');
    expect(H.captureDecide('junk', blank, names, now, 30 * DAY)).toBe('none');
  });
});

// --- Run the real script against a small DOM stub ----------------------------

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

type El = { [k: string]: any };
function makeEl(tag: string, extra: El = {}): El {
  const el: El = {
    tagName: tag, value: '', textContent: '', className: '', hidden: false, children: [] as El[], attrs: {} as Record<string, string>, listeners: {} as Record<string, Array<(e: unknown) => void>>,
    setAttribute(k: string, v: string) { el.attrs[k] = v; },
    getAttribute(k: string) { return k in el.attrs ? el.attrs[k] : null; },
    removeAttribute(k: string) { delete el.attrs[k]; },
    appendChild(c: El) { el.children.push(c); c.parentNode = el; return c; },
    insertBefore(c: El, ref: El | null) { const i = ref ? el.children.indexOf(ref) : -1; if (i < 0) el.children.push(c); else el.children.splice(i, 0, c); c.parentNode = el; return c; },
    removeChild(c: El) { el.children = el.children.filter((x: El) => x !== c); c.parentNode = null; return c; },
    addEventListener(ev: string, fn: (e: unknown) => void) { (el.listeners[ev] ??= []).push(fn); },
    focus() {}, scrollIntoView() {}, closest() { return null; },
    ...extra,
  };
  return el;
}

function stubPage(opts: { values?: Record<string, string>; id?: string; search?: string; local?: MemStorage; session?: MemStorage; clearId?: string; withForm?: boolean }) {
  const local = opts.local ?? new MemStorage();
  const session = opts.session ?? new MemStorage();
  const root = makeEl('main');
  const names = ['category', 'title', 'locale', 'intro', 'ingredients', 'steps', 'prep', 'cook', 'servings', 'display_name', 'source_kind', 'source_url'];
  const fields: Record<string, El> = {};
  for (const n of names) fields[n] = makeEl(n === 'category' || n === 'locale' || n === 'source_kind' ? 'select' : 'input', { value: opts.values?.[n] ?? (n === 'source_kind' ? 'original' : n === 'locale' ? 'us:en' : '') });
  fields['category']!.options = [{ value: '', textContent: '' }];
  fields['attest'] = makeEl('input', { checked: false });
  if (opts.id) fields['id'] = makeEl('input', { value: opts.id });
  const sourceWrap = makeEl('div');
  const checks: Record<string, El> = {};
  for (const k of ['title', 'ingredients', 'qty', 'cups', 'steps', 'servings', 'source']) checks[k] = makeEl('li');
  const form = makeEl('form', {
    querySelector(sel: string) {
      if (sel === 'input[name="id"]') return fields['id'] ?? null;
      if (sel === '[data-source-link]') return sourceWrap;
      const m = /^\[name="(.+)"\]$/.exec(sel);
      if (m) return fields[m[1]!] ?? null;
      return null;
    },
  });
  root.appendChild(form);
  form.appendChild(fields['attest']!);
  const box = makeEl('ul', { querySelector: (sel: string) => { const m = /^\[data-check="(.+)"\]$/.exec(sel); return m ? checks[m[1]!] : null; } });
  const catLabels = JSON.stringify({ en: { __prompt: 'P', __unsure: 'U', __preamble: 'A', __preambleHint: 'H' } });
  const clearEl = opts.clearId ? makeEl('div', { attrs: { 'data-capture-clear': opts.clearId } }) : null;
  const doc = {
    documentElement: { lang: 'en' },
    querySelector(sel: string) {
      if (sel === 'form[data-capture-form]') return opts.withForm === false ? null : form;
      if (sel === '[data-live-checks]') return box;
      if (sel === '[data-capture-clear]') return clearEl;
      return null;
    },
    getElementById(id: string) {
      if (id === 'capture-check-strings') return { textContent: CAPTURE_CHECK_STRINGS };
      if (id === 'capture-cat-labels') return { textContent: catLabels };
      return null;
    },
    createElement: (tag: string) => makeEl(tag),
    createTextNode: (t: string) => makeEl('#text', { textContent: t }),
  };
  const win = { localStorage: local, sessionStorage: session, location: { search: opts.search ?? '' }, addEventListener() {} };
  new Function('document', 'window', CAPTURE_CLIENT_SCRIPT)(doc, win);
  const fire = (ev: string, e: unknown = {}) => (form.listeners[ev] ?? []).forEach((fn: (e: unknown) => void) => fn(e));
  const notices = () => root.children.filter((c: El) => String(c.className).includes('draft-notice'));
  return { local, session, fields, form, fire, notices, sourceWrap };
}

describe('capture autosave (real script, stub DOM)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const KEY_NEW = '2yolks:capture:new';
  const copy = (f: Record<string, string>, at = Date.now()) => JSON.stringify({ v: 1, at, f });

  it('saves typed fields to this device (debounced), and removes the copy when the form is emptied', () => {
    const p = stubPage({});
    p.fields['title']!.value = 'Abuela Soup';
    p.fields['ingredients']!.value = '1 onion';
    p.fire('input');
    expect(p.local.getItem(KEY_NEW)).toBeNull();
    vi.advanceTimersByTime(500);
    const saved = JSON.parse(p.local.getItem(KEY_NEW)!);
    expect(saved.f.title).toBe('Abuela Soup');
    expect(saved.f.ingredients).toBe('1 onion');
    expect(saved.f).not.toHaveProperty('attest'); // consent is never auto-restored
    p.fields['title']!.value = '';
    p.fields['ingredients']!.value = '';
    p.fire('input');
    vi.advanceTimersByTime(500);
    expect(p.local.getItem(KEY_NEW)).toBeNull();
  });

  it('restores into a blank new form with a notice, and Discard puts the blank form back', () => {
    const local = new MemStorage();
    local.setItem(KEY_NEW, copy({ title: 'Lost Soup', ingredients: '1 leek', steps: 'Boil.' }));
    const p = stubPage({ local });
    expect(p.fields['title']!.value).toBe('Lost Soup');
    expect(p.fields['ingredients']!.value).toBe('1 leek');
    const [n] = p.notices();
    expect(n!.children[0].textContent).toBe('Restored your unsaved draft from this device.');
    const discard = n!.children[1];
    expect(discard.textContent).toBe('Discard');
    discard.listeners['click'][0]();
    expect(p.fields['title']!.value).toBe('');
    expect(local.getItem(KEY_NEW)).toBeNull();
    expect(p.notices()).toHaveLength(0);
  });

  it('on a filled form (e.g. after Paste), only offers the device copy; Restore applies it', () => {
    const local = new MemStorage();
    local.setItem(KEY_NEW, copy({ title: 'Typed Soup', ingredients: '1 leek', steps: 'Boil.' }));
    const p = stubPage({ local, values: { title: 'Pasted Tea', ingredients: 'leaves', steps: 'Steep.' } });
    expect(p.fields['title']!.value).toBe('Pasted Tea');
    const [n] = p.notices();
    expect(n!.children[0].textContent).toBe('This device has unsaved changes for this recipe.');
    n!.children[1].listeners['click'][0]();
    expect(p.fields['title']!.value).toBe('Typed Soup');
  });

  it('a successful save (?saved=1) clears the copy that was just submitted', () => {
    const local = new MemStorage();
    const session = new MemStorage();
    local.setItem(KEY_NEW, copy({ title: 'Soup', ingredients: '1 leek', steps: 'Boil.' }));
    // submitting the new form marks its key as pending
    const p1 = stubPage({ local, session, values: { title: 'Soup', ingredients: '1 leek', steps: 'Boil.' } });
    p1.fire('submit', { submitter: { value: 'save' }, preventDefault() {} });
    expect(session.getItem('2yolks:capture:pending')).toBe(KEY_NEW);
    // ...the server redirects to the edit page with ?saved=1
    stubPage({ local, session, id: 'abc123', search: '?saved=1', values: { title: 'Soup', ingredients: '1 leek', steps: 'Boil.' } });
    expect(local.getItem(KEY_NEW)).toBeNull();
    expect(session.getItem('2yolks:capture:pending')).toBeNull();
  });

  it('the "sent in" page drops the device copy of the submitted draft', () => {
    const local = new MemStorage();
    local.setItem('2yolks:capture:abc123', copy({ title: 'Soup', ingredients: '1 leek', steps: 'Boil.' }));
    stubPage({ local, clearId: 'abc123', withForm: false });
    expect(local.getItem('2yolks:capture:abc123')).toBeNull();
  });

  it('"Send in for review" without the permission box is stopped client-side with an inline error', () => {
    const p = stubPage({ values: { title: 'Soup' } });
    p.fields['attest']!.setAttribute('data-err-attest', 'Tick the permission box to send this recipe in for review.');
    let prevented = false;
    p.fire('submit', { submitter: { value: 'submit' }, preventDefault() { prevented = true; } });
    expect(prevented).toBe(true);
    expect(p.fields['attest']!.getAttribute('aria-invalid')).toBe('true');
    expect(p.fields['attest']!.getAttribute('aria-describedby')).toBe('err-attest');
  });

  it('hides "Link to the original" unless the recipe is adapted', () => {
    const p = stubPage({});
    expect(p.sourceWrap.hidden).toBe(true);
    p.fields['source_kind']!.value = 'adapted';
    p.fire('change');
    expect(p.sourceWrap.hidden).toBe(false);
  });
});
