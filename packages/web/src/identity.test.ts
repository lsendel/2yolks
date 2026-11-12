import {describe,it,expect} from 'vitest';
import {renderHome,renderRecipe,renderRecipeCardSvg,renderAbout,isoDuration} from './server';
import {discoveryRecipes} from './App';
const rows=[{id:'r1',country:'us',lang:'en',slug:'a',title:'First recipe',category:'soups-stews',untested:true,totalMinutes:70},{id:'r1',country:'us',lang:'fr',slug:'b',title:'Première recette',category:'soups-stews',untested:true,totalMinutes:70},{id:'r2',country:'mx',lang:'en',slug:'c',title:'Second recipe',category:'dumplings',untested:true}];
describe('After hours discovery',()=>{
 it('uses selected language with one row per recipe, no country-as-cuisine grouping',()=>{
  expect(discoveryRecipes(rows,'fr').map(r=>r.title)).toEqual(['Première recette','Second recipe']);
  const html=renderHome({recipes:rows,locales:[],lang:'fr'});
  expect(html).toContain('Trouvez votre saveur');expect(html).toContain('<html lang="fr">');
  expect(html).not.toContain('class="country-grid"');expect(html).not.toContain('class="country-block"');
  expect(html).toContain('générée par IA');expect(html).not.toContain('Sign in');expect(html).not.toContain('trending');
 });
 it('filter is language-preserving and only lists real categories',()=>{
  const html=renderHome({recipes:rows,locales:[],lang:'en',activeCategory:'dumplings'});
  expect(html).toContain('/?lang=en&amp;cat=dumplings#recipes');
  expect(html.match(/class="recipe-number"/g)).toHaveLength(1);
  expect(html).not.toContain('cat=tacos-tortillas');
 });
 it('shows known total only, never invents prep/cook or zero values',()=>{
  const html=renderHome({recipes:rows,locales:[]});
  expect(html).toContain('1 h 10 min');expect(html).not.toContain('>0 min<');
 });
 it('includes rich homepage SEO metadata, WebSite/ItemList JSON-LD, and instant search without empty eyebrows',()=>{
  const uncat=[...rows,{id:'r3',country:'us',lang:'en',slug:'d',title:'Uncategorized Dish',category:null,untested:true}];
  const html=renderHome({recipes:uncat,locales:[],lang:'en',activeCategory:'dumplings'});
  expect(html).toContain('<link rel="canonical" href="https://2yolks.com/" />');
  expect(html).toContain('property="og:image" content="https://2yolks.com/img/identity/after-hours.webp"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('"@type":"WebSite"');
  expect(html).toContain('"@type":"ItemList"');
  expect(html).toContain('data-recipe-search');
  const fullHtml=renderHome({recipes:uncat,locales:[],lang:'en'});
  expect(fullHtml).not.toContain('<span class="eyebrow"></span>');
 });
 it('formats ISO 8601 durations and renders rich Recipe + BreadcrumbList JSON-LD, viral share card, and related recipes',()=>{
  expect(isoDuration(70)).toBe('PT1H10M');
  expect(isoDuration(25)).toBe('PT25M');
  expect(isoDuration(120)).toBe('PT2H');
  expect(isoDuration(null)).toBeUndefined();
  const html=renderRecipe(
   {
    recipe:{id:'9214e255',sourceId:'s1',originCountry:'us',imageKey:null,createdAt:'2026-11-01',prepMinutes:15,cookMinutes:90,restMinutes:10,totalMinutes:115,baseServings:8,category:'soups-stews'},
    locale:{recipeId:'9214e255',country:'us',lang:'en',title:'Sweet Potato Casserole',slug:'sweet-potato-casserole',intro:'A rich holiday bake.',ingredientsJson:'["2 lb sweet potatoes"]',stepsJson:'["Bake 45 minutes."]',status:'published'},
    source:{id:'s1',name:'2yolks',url:'/about',license:'CC0-1.0',clearedAt:'2026-11-01',notes:null},
   },
   [{hreflang:'en-US',href:'https://2yolks.com/us/recipes/sweet-potato-casserole'}],
   {countryName:'United States',related:[{id:'r2',country:'mx',lang:'en',slug:'c',title:'Second recipe',category:'dumplings',totalMinutes:30}]},
  );
  expect(html).toContain('"prepTime":"PT15M"');
  expect(html).toContain('"cookTime":"PT1H30M"');
  expect(html).toContain('"totalTime":"PT1H55M"');
  expect(html).toContain('"recipeYield":"8 servings"');
  expect(html).toContain('"recipeCategory":"Soups \\u0026 stews"');
  expect(html).toContain('"@type":"BreadcrumbList"');
  expect(html).toContain('/img/pin/9214e255.en.png');
  expect(html).toContain('reddit.com/submit');
  expect(html).toContain('t.me/share');
  expect(html).toContain('data-copy-ingredients');
  expect(html).toContain('data-share-card');
  expect(html).toContain('class="related-recipes"');
  expect(html).toContain('Second recipe');
 });
});

import { THEME_CLIENT_SCRIPT, CAPTURE_CLIENT_SCRIPT, DISCOVERY_CLIENT_SCRIPT, RECIPE_CLIENT_SCRIPT } from './clientScript';

describe('inline client scripts & SVG/theme enhancements', () => {
  it('every inline script is syntactically valid JavaScript', () => {
    for (const src of [THEME_CLIENT_SCRIPT, CAPTURE_CLIENT_SCRIPT, DISCOVERY_CLIENT_SCRIPT, RECIPE_CLIENT_SCRIPT]) {
      expect(() => new Function(src)).not.toThrow();
    }
  });
  it('capture checks flag ambiguous cup measures and missing quantities', () => {
    expect(CAPTURE_CLIENT_SCRIPT).toContain('cup');
    expect(CAPTURE_CLIENT_SCRIPT).toContain('data-check');
  });
  it('activates Fraunces display typography, inline SVG marks, view/theme toggles, and 9:16 Story SVG card', () => {
    const home = renderHome({ recipes: rows, locales: [], lang: 'en' });
    expect(home).toContain("--font-display:'Fraunces'");
    expect(home).toContain('class="brand-yolks-svg"');
    expect(home).toContain('class="cat-icon"');
    expect(home).toContain('data-view-btn="grid"');
    expect(home).toContain('data-theme-toggle');
    expect(home).toContain('/account/recipes/new');

    const cardSvg = renderRecipeCardSvg({
      recipe: { id: '9214e255', sourceId: 's1', originCountry: 'us', imageKey: null, createdAt: '2026-11-01', totalMinutes: 55, baseServings: 6, category: 'soups-stews', testedAt: '2026-11-05' },
      locale: { recipeId: '9214e255', country: 'us', lang: 'en', title: 'Pozole Rojo & Garnishes', slug: 'pozole-rojo', intro: 'Rich guajillo broth.', ingredientsJson: '["1 kg pork shoulder, in 4 cm pieces"]', stepsJson: '["Simmer gently."]', status: 'published' },
      source: { id: 's1', name: '2yolks', url: 'https://2yolks.com/', license: 'CC0-1.0', clearedAt: '2026-11-01', notes: null },
    });
    expect(cardSvg).toContain('<svg');
    expect(cardSvg).toContain('Pozole Rojo &amp; Garnishes');
    expect(cardSvg).toContain('2 ¼ lb pork shoulder, in 4 cm pieces');
    expect(cardSvg).toContain('#CookedWith2Yolks');

    const aboutFr = renderAbout([], 'https://2yolks.com', 'fr');
    expect(aboutFr).toContain('À propos de 2yolks');
    expect(aboutFr).not.toContain('<h1>About 2yolks</h1>');
  });
});
