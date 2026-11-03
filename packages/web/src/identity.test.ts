import {describe,it,expect} from 'vitest';
import {renderHome,renderRecipe} from './server';
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
});
