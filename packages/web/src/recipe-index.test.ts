import { describe, it, expect } from 'vitest';
import { renderRecipeIndex } from './server';
import { categoryLabel, recipePathFor, uiStrings } from '@2yolks/contracts';

const ROWS = [
  {
    id: 'r1',
    country: 'us',
    lang: 'en',
    slug: 'test-cookies',
    title: 'Test Cookies',
    category: 'desserts-baking',
    untested: true,
    totalMinutes: 30,
  },
  {
    id: 'r2',
    country: 'us',
    lang: 'en',
    slug: 'test-tacos',
    title: 'Test Tacos',
    category: 'tacos-tortillas',
    untested: false,
    totalMinutes: 45,
  },
  // One recipe with two locale rows: the index must list it once.
  {
    id: 'r3',
    country: 'mx',
    lang: 'en',
    slug: 'test-pozole',
    title: 'Test Pozole',
    category: 'soups-stews',
    untested: true,
    totalMinutes: 130,
  },
  {
    id: 'r3',
    country: 'mx',
    lang: 'es',
    slug: 'pozole-de-prueba',
    title: 'Pozole de prueba',
    category: 'soups-stews',
    untested: true,
    totalMinutes: 130,
  },
];

describe('renderRecipeIndex (/recipes index page)', () => {
  it('renders a heading and every recipe exactly once, grouped under category labels', () => {
    const html = renderRecipeIndex({ recipes: ROWS, lang: 'en' });
    expect(html).toContain('<h1>All recipes</h1>');
    for (const cat of ['desserts-baking', 'tacos-tortillas', 'soups-stews']) {
      expect(html).toContain(`<h2>${categoryLabel(cat, 'en')!.replace(/&/g, '&amp;')}</h2>`);
    }
    for (const title of ['Test Cookies', 'Test Tacos', 'Test Pozole']) {
      expect(html.indexOf(title)).not.toBe(-1);
      // title appears in the link text and its aria/JSON-LD copies; the list
      // row link itself must be unique per recipe
      expect(html.split(`>${title}</a>`).length - 1).toBe(1);
    }
    expect(html).toContain(recipePathFor('us', 'en', 'test-cookies'));
    expect(html).toContain(recipePathFor('mx', 'en', 'test-pozole'));
  });

  it('keeps the honest untested badge and total time', () => {
    const html = renderRecipeIndex({ recipes: ROWS, lang: 'en' });
    expect(html).toContain(uiStrings('en').untestedBadge);
    expect(html).toContain('45 min');
  });

  it('picks the page-language locale row when one exists', () => {
    const html = renderRecipeIndex({ recipes: ROWS, lang: 'es' });
    expect(html).toContain('<h1>Todas las recetas</h1>');
    expect(html).toContain('Pozole de prueba');
    expect(html).not.toContain('Test Pozole');
    // en-only recipes stay listed with a fallback-language badge
    expect(html).toContain('Test Cookies');
    expect(html).toContain('English');
  });

  it('emits canonical, hreflang alternates and an ItemList JSON-LD', () => {
    const html = renderRecipeIndex({ recipes: ROWS, lang: 'en' }, [], 'https://2yolks.com');
    expect(html).toContain('hreflang="es" href="https://2yolks.com/recipes?lang=es"');
    expect(html).toContain('hreflang="x-default" href="https://2yolks.com/recipes"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"numberOfItems":3');
  });

  it('renders an empty catalog without crashing', () => {
    const html = renderRecipeIndex({ recipes: [], lang: 'en' });
    expect(html).toContain('<h1>All recipes</h1>');
    expect(html).not.toContain('"numberOfItems"');
  });
});

describe('recipe index row structure (discovery-list parity with the home list)', () => {
  const IMAGED = [
    { id: 'r9', country: 'us', lang: 'en', slug: 'imaged-soup', title: 'Imaged Soup', category: 'soups-stews', untested: true, totalMinutes: 40, imageId: 'img-r9', imageStyle: 'photo' as const },
  ];
  it('renders number, category eyebrow with icon, and grid columns the CSS expects', () => {
    const html = renderRecipeIndex({ recipes: IMAGED, lang: 'en' });
    // .discovery-list li grid is "number | thumb? | title | row-end": the
    // number span must exist or the title falls into the 2.2rem track.
    expect(html).toContain('class="recipe-number"');
    expect(html).toContain('cat-icon');
    expect(html).toContain('class="eyebrow"');
  });
  it('shows the rights-cleared thumbnail with its readable honest label', () => {
    const html = renderRecipeIndex({ recipes: IMAGED, lang: 'en' });
    expect(html).toContain('has-thumb');
    expect(html).toContain('/img/recipe/img-r9');
    expect(html).toContain('thumb-label');
    expect(html).toContain('Photo');
  });
});
