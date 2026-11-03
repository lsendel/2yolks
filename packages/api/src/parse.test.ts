import { describe, expect, it } from 'vitest';
import { parseRecipeText, parseJsonLdRecipe, isoMinutes } from './parse';

describe('parseRecipeText', () => {
  it('parses English text', () => {
    const p = parseRecipeText('Garlic Noodles\nQuick and savory.\n\nIngredients\n- 200g noodles\n- 3 cloves garlic\n\nInstructions\n1. Boil noodles.\n2) Toss with garlic.');
    expect(p.title).toBe('Garlic Noodles');
    expect(p.intro).toBe('Quick and savory.');
    expect(p.ingredients).toEqual(['200g noodles', '3 cloves garlic']);
    expect(p.steps).toEqual(['Boil noodles.', 'Toss with garlic.']);
    expect(p.warnings).toEqual([]);
  });
  it('parses Spanish and French headings', () => {
    const es = parseRecipeText('Pozole\nIngredientes:\nmaíz\nPreparación:\nCocer.');
    expect(es.ingredients).toEqual(['maíz']); expect(es.steps).toEqual(['Cocer.']);
    const fr = parseRecipeText('Crêpes\nIngrédients\nfarine\nPréparation\nMélanger.');
    expect(fr.ingredients).toEqual(['farine']); expect(fr.steps).toEqual(['Mélanger.']);
  });
  it('warns when sections are missing and caps size', () => {
    const p = parseRecipeText('Just a title');
    expect(p.warnings.length).toBe(2);
    const many = parseRecipeText('T\nIngredients\n' + Array(200).fill('x').join('\n') + '\nSteps\ny');
    expect(many.ingredients.length).toBe(80);
  });
});

describe('parseJsonLdRecipe', () => {
  const wrap = (j: unknown) => `<html><script type="application/ld+json">${JSON.stringify(j)}</script></html>`;
  it('reads a Recipe inside @graph with HowToSteps', () => {
    const p = parseJsonLdRecipe(wrap({ '@graph': [{ '@type': 'WebSite' }, { '@type': 'Recipe', name: 'Soup &amp; Bread', description: 'Warm.', recipeIngredient: ['1 onion', '2 cups stock'], recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Chop.' }] }, { '@type': 'HowToStep', text: 'Simmer.' }], prepTime: 'PT15M', cookTime: 'PT1H30M', recipeYield: '4 servings', author: { name: 'Ana' } }] }))!;
    expect(p.title).toBe('Soup & Bread');
    expect(p.steps).toEqual(['Chop.', 'Simmer.']);
    expect(p.prepMinutes).toBe(15); expect(p.cookMinutes).toBe(90); expect(p.servings).toBe(4); expect(p.authorName).toBe('Ana');
  });
  it('strips tags, ignores invalid JSON and pages without recipes', () => {
    expect(parseJsonLdRecipe('<script type="application/ld+json">{bad</script>')).toBeNull();
    expect(parseJsonLdRecipe(wrap({ '@type': 'Article' }))).toBeNull();
    const p = parseJsonLdRecipe(wrap({ '@type': 'Recipe', name: 'X', recipeIngredient: ['<b>a</b>'], recipeInstructions: 'Step one\nStep two' }))!;
    expect(p.ingredients).toEqual(['a']); expect(p.steps).toEqual(['Step one', 'Step two']);
  });
  it('parses durations', () => { expect(isoMinutes('PT45M')).toBe(45); expect(isoMinutes('PT2H')).toBe(120); expect(isoMinutes('junk')).toBeUndefined(); });
});
