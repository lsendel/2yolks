// Runs the REAL inline discovery script against a tiny fake DOM, so search
// precision is tested on the code that ships (not a re-implementation).
import { describe, it, expect } from 'vitest';
import { DISCOVERY_CLIENT_SCRIPT } from './clientScript';

type Attrs = Record<string, string>;

class FakeEl {
  hidden = false;
  textContent = '';
  value = '';
  children: FakeEl[] = [];
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  constructor(public attrs: Attrs = {}, public selectorMap: Record<string, FakeEl | null> = {}) {}
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k]! : null; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  querySelector(sel: string) { return this.selectorMap[sel] ?? null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  appendChild(c: FakeEl) { this.children = this.children.filter((x) => x !== c); this.children.push(c); return c; }
  addEventListener(type: string, fn: (e: unknown) => void) { (this.listeners[type] ??= []).push(fn); }
  focus() {}
  set innerHTML(_v: string) { this.children = []; }
}

interface Recipe { title: string; category: string; body: string }

function setup(recipes: Recipe[], opts: { searchAll?: boolean } = {}) {
  const items = recipes.map((r) => {
    const a = new FakeEl({ href: '/x' });
    (a as unknown as { href: string }).href = '/x';
    const h3 = new FakeEl();
    h3.textContent = r.title;
    return new FakeEl(
      { 'data-recipe-item': '', 'data-title': r.title, 'data-category': r.category, 'data-body': r.body },
      { h3, 'h3 a': a, '.recipe-number': new FakeEl() },
    );
  });
  const input = new FakeEl();
  const list = new FakeEl();
  const status = new FakeEl({ 'data-one': '1 recipe found', 'data-many': '{n} recipes found' });
  const emptyEl = new FakeEl({ 'data-nothing-matches': "Nothing matches '{q}' yet" });
  const closest = new FakeEl();
  const suggestionsList = new FakeEl();
  const searchAll = opts.searchAll ? new FakeEl({ 'data-base': '/?lang=es', href: '/?lang=es#recipes' }) : null;
  const filterEmpty = new FakeEl();
  const single: Record<string, FakeEl | null> = {
    '[data-recipe-list]': list,
    '[data-recipe-search]': input,
    '[data-search-empty]': emptyEl,
    '[data-closest-note]': closest,
    '[data-clear-search]': new FakeEl(),
    '[data-empty-msg]': new FakeEl(),
    '[data-empty-suggestions]': new FakeEl(),
    '[data-suggestions-list]': suggestionsList,
    '[data-search-status]': status,
    '[data-filter-empty]': filterEmpty,
    '[data-search-all]': searchAll,
  };
  const document = {
    documentElement: { lang: 'en' },
    querySelector: (sel: string) => single[sel] ?? null,
    querySelectorAll: (sel: string) => (sel === '[data-recipe-item]' ? items : []),
    createElement: () => new FakeEl(),
  };
  const window = { location: { href: 'https://2yolks.test/', search: '', hash: '' } };
  const history = { pushState() {}, replaceState() {} };
  const localStorage = { getItem: () => null, setItem() {} };
  const fetchCalls: string[] = [];
  const fetch = (url: string) => { fetchCalls.push(url); return Promise.resolve(); };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('document', 'window', 'history', 'localStorage', 'fetch', 'URL', 'URLSearchParams', DISCOVERY_CLIENT_SCRIPT)(
    document, window, history, localStorage, fetch, URL, URLSearchParams,
  );
  const search = (q: string) => {
    input.value = q;
    for (const fn of input.listeners.input ?? []) fn({});
    return {
      titles: items.filter((i) => !i.hidden).map((i) => i.attrs['data-title']!),
      status: status.textContent,
      fuzzyNote: !closest.hidden,
      empty: !emptyEl.hidden,
      suggestions: suggestionsList.children.map((li) => li.children[0]?.textContent ?? ''),
      searchAllHref: searchAll?.getAttribute('href') ?? null,
      filterEmptyHidden: filterEmpty.hidden,
    };
  };
  return { search };
}

const CATALOG: Recipe[] = [
  { title: 'Tzatziki Pasta Salad', category: 'Sides', body: 'rotini pasta cucumber greek yogurt dill' },
  { title: 'Mulled Wine', category: 'Drinks', body: 'red wine orange cloves honey. Sweeten to taste.' },
  { title: 'Hot Toddy', category: 'Drinks', body: 'whiskey honey lemon. Adjust to taste and serve.' },
  { title: 'Brown Butter Cardamom Chocolate Chip Cookies', category: 'Desserts & baking', body: 'flour butter cardamom chocolate chips' },
  { title: 'Crème Brûlée French Toast', category: 'Breakfast', body: 'brioche eggs cream sugar' },
  { title: 'Red Chicken Enchiladas', category: 'Tacos & tortilla dishes', body: 'corn tortillas shredded chicken' },
];

describe('discovery search precision (shipped script)', () => {
  it('"pasta" no longer surfaces drinks that merely say "taste"', () => {
    const r = setup(CATALOG).search('pasta');
    expect(r.titles).toEqual(['Tzatziki Pasta Salad']);
    expect(r.fuzzyNote).toBe(false);
  });

  it('typos still work as a fallback pass, flagged as closest matches', () => {
    const r = setup(CATALOG).search('chiken');
    expect(r.titles).toEqual(['Red Chicken Enchiladas']);
    expect(r.fuzzyNote).toBe(true);
    const c = setup(CATALOG).search('choclate chip');
    expect(c.titles).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
  });

  it('fuzzy never matches long free text (intros/ingredients)', () => {
    // "tasty" is 1 edit from "taste", which only appears in drink bodies.
    const r = setup(CATALOG).search('tasty');
    expect(r.titles).toEqual([]);
    expect(r.empty).toBe(true);
  });

  it('announces result counts for screen readers', () => {
    const s = setup(CATALOG);
    expect(s.search('pasta').status).toBe('1 recipe found');
    expect(s.search('honey').status).toBe('2 recipes found');
    expect(s.search('').status).toBe('');
  });

  it('"Did you mean" shows real titles with case and accents intact', () => {
    const r = setup(CATALOG).search('brulee');
    // exact (accent-folded) title match, so it is a hit, not a suggestion
    expect(r.titles).toEqual(['Crème Brûlée French Toast']);
    const miss = setup(CATALOG).search('tost');
    expect(miss.titles).toEqual([]);
    expect(miss.suggestions).toContain('Crème Brûlée French Toast');
  });

  it('keeps the "search all categories" link in sync with the query', () => {
    const r = setup(CATALOG, { searchAll: true }).search('pozole rojo');
    expect(r.searchAllHref).toBe('/?lang=es&q=pozole+rojo#recipes');
    expect(r.filterEmptyHidden).toBe(true);
  });
});
