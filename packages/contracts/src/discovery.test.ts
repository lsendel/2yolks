import { describe, expect, it } from 'vitest';
import {
  inferDiets,
  inferNoOven,
  inferDifficulty,
  matchesCollection,
  matchesCuisine,
  resolveCuisineSlug,
  availableCuisines,
  searchCatalog,
  suggestCatalog,
  SEARCH_PAGE_SIZE,
  type SearchableRecipe,
} from './index';

describe('inferDiets (honest, multilingual ingredient-based inference)', () => {
  it('returns empty array when ingredients text is empty', () => {
    expect(inferDiets('')).toEqual([]);
    expect(inferDiets(null)).toEqual([]);
  });

  it('recognizes plant-based dishes as vegan, vegetarian, dairy-free, gluten-free', () => {
    expect(inferDiets('1 can black beans coconut milk corn tortillas cilantro lime')).toEqual([
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
    ]);
    // Spanish plant-based false positives stripped (butternut, eggplant, leche de coco, harina de maíz)
    expect(inferDiets('1 calabaza butternut leche de coco tortillas de maíz cilantro')).toEqual([
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
    ]);
    // French aubergine, lait d'avoine, farine de maïs
    expect(inferDiets("1 aubergine lait d'avoine farine de mais huile d'olive")).toEqual([
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
    ]);
  });

  it('excludes meat, poultry, seafood, meat broths, and gelatin accurately', () => {
    expect(inferDiets('chicken broth olive oil rice')).not.toContain('vegetarian');
    expect(inferDiets('1 lb shrimp garlic butter')).not.toContain('vegetarian');
    expect(inferDiets('500 g camarones tomate cebolla')).not.toContain('vegetarian');
    expect(inferDiets('200 g boeuf carottes')).not.toContain('vegetarian');
    // Vegetable broth stays vegetarian and vegan!
    expect(inferDiets('vegetable broth carrots onion celery')).toContain('vegan');
  });

  it('excludes dairy and eggs properly while stripping peanut/cocoa/cream-of-tartar', () => {
    const eggCookie = inferDiets('peanut butter brown sugar eggs baking soda');
    expect(eggCookie).toContain('vegetarian');
    expect(eggCookie).toContain('dairy-free');
    expect(eggCookie).not.toContain('vegan');

    const plantMeringue = inferDiets('cocoa butter cream of tartar almond milk sugar');
    expect(plantMeringue).toContain('vegan');
    expect(plantMeringue).toContain('dairy-free');

    const quesoTaco = inferDiets('corn tortillas queso fresco crema frijoles');
    expect(quesoTaco).toContain('vegetarian');
    expect(quesoTaco).toContain('gluten-free');
    expect(quesoTaco).not.toContain('dairy-free');
  });

  it('flags wheat flour, pasta, soy sauce, and Spanish bread while sparing corn/almond/tamari', () => {
    expect(inferDiets('spaghetti olive oil garlic')).not.toContain('gluten-free');
    expect(inferDiets('soy sauce tofu rice scallions')).not.toContain('gluten-free');
    expect(inferDiets('tamari tofu rice scallions')).toContain('gluten-free');
    expect(inferDiets('4 rebanadas de pan aguacate jitomate')).not.toContain('gluten-free');
  });
});

describe('inferNoOven & inferDifficulty', () => {
  it('identifies stovetop / no-bake recipes and rejects oven or baking temp steps', () => {
    expect(inferNoOven('No-Bake Peanut Oat Bars', null, '')).toBe(true);
    expect(inferNoOven('Skillet Tacos', null, 'Heat skillet over medium heat. Brown mushrooms 6 min.')).toBe(true);
    expect(inferNoOven('Sheet-Pan Chicken', null, 'Preheat oven to {t:425F} and roast 25 minutes.')).toBe(false);
    expect(inferNoOven('Pastel de chocolate', null, 'Hornear a {t:180C} por 30 minutos.')).toBe(false);
    expect(inferNoOven('Mysterious Dish', null, '')).toBe(false);
  });

  it('buckets difficulty deterministically from time, steps, and ingredients', () => {
    expect(inferDifficulty({})).toBeNull();
    expect(inferDifficulty({ totalMinutes: 20, stepsCount: 4, ingredientsCount: 6 })).toBe('easy');
    expect(inferDifficulty({ totalMinutes: 50, stepsCount: 8, ingredientsCount: 10 })).toBe('medium');
    expect(inferDifficulty({ totalMinutes: 130, stepsCount: 6, ingredientsCount: 8 })).toBe('project');
    expect(inferDifficulty({ totalMinutes: 40, stepsCount: 13, ingredientsCount: 6 })).toBe('project');
  });
});

describe('cuisines, collections, searchCatalog & suggestCatalog', () => {
  const ITEMS: SearchableRecipe[] = [
    {
      id: 'r1',
      slug: 'pozole-rojo',
      title: 'Pozole rojo de cerdo',
      country: 'mx',
      lang: 'es',
      originCountry: 'mx',
      category: 'soups-stews',
      totalMinutes: 120,
      untested: false,
      intro: 'Caldo tradicional con maiz pozolero.',
      ingredients: 'espaldilla de cerdo maiz pozolero chiles guajillo',
      diets: ['gluten-free', 'dairy-free'],
      difficulty: 'project',
      noOven: true,
    },
    {
      id: 'r2',
      slug: 'black-bean-tacos',
      title: 'Quick Black Bean Tacos',
      country: 'us',
      lang: 'en',
      originCountry: 'mx',
      category: 'tacos-tortillas',
      totalMinutes: 20,
      untested: true,
      intro: 'Fast weeknight skillet tacos.',
      ingredients: 'black beans corn tortillas lime avocado cilantro',
      diets: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      difficulty: 'easy',
      noOven: true,
    },
    {
      id: 'r3',
      slug: 'sweet-potato-casserole',
      title: 'Sweet Potato Casserole',
      country: 'us',
      lang: 'en',
      originCountry: 'us',
      category: 'sides',
      totalMinutes: 55,
      untested: true,
      intro: 'Warm pecan topping for Thanksgiving dinner.',
      ingredients: 'sweet potatoes butter brown sugar pecans marshmallows',
      diets: ['vegetarian', 'gluten-free'],
      difficulty: 'medium',
      noOven: false,
    },
    {
      id: 'r4',
      slug: 'golumpki-soup',
      title: 'Golumpki Cabbage Soup',
      country: 'us',
      lang: 'en',
      originCountry: 'pl',
      category: 'soups-stews',
      totalMinutes: 45,
      untested: true,
      intro: 'Polish stuffed cabbage flavors in one pot.',
      ingredients: 'ground beef green cabbage white rice crushed tomatoes',
      diets: ['gluten-free', 'dairy-free'],
      difficulty: 'medium',
      noOven: true,
    },
  ];

  it('resolves cuisines by slug or country code without misattributing origin_country', () => {
    expect(resolveCuisineSlug('mx')).toBe('mexican');
    expect(resolveCuisineSlug('Polish')).toBe('polish');
    expect(matchesCuisine(ITEMS[1]!, 'mexican')).toBe(true); // originCountry='mx'
    expect(matchesCuisine(ITEMS[1]!, 'american')).toBe(false);
    expect(matchesCuisine(ITEMS[3]!, 'polish')).toBe(true);
    const list = availableCuisines(ITEMS, 'es');
    expect(list.find((c) => c.slug === 'mexican')?.count).toBe(2);
    expect(list.find((c) => c.slug === 'polish')?.label).toBe('Polaca');
  });

  it('matches collection rules cleanly', () => {
    expect(matchesCollection(ITEMS[1]!, 'quick')).toBe(true);
    expect(matchesCollection(ITEMS[1]!, 'weeknight')).toBe(true);
    expect(matchesCollection(ITEMS[1]!, 'vegetarian')).toBe(true);
    expect(matchesCollection(ITEMS[1]!, 'no-oven')).toBe(true);
    expect(matchesCollection(ITEMS[2]!, 'thanksgiving')).toBe(true);
    expect(matchesCollection(ITEMS[2]!, 'no-oven')).toBe(false);
  });

  it('combines filters, reports unfilteredCount when filters hide matches, and paginates at 24', () => {
    const res = searchCatalog(ITEMS, { q: 'pozole', diet: 'vegetarian' }, 'en');
    expect(res.total).toBe(0);
    expect(res.unfilteredCount).toBe(1);

    const testedMex = searchCatalog(ITEMS, { cuisine: 'mexican', tested: true }, 'en');
    expect(testedMex.items.map((x) => x.id)).toEqual(['r1']);

    const fuzzy = searchCatalog(ITEMS, { q: 'chiken' }, 'en');
    expect(fuzzy.total).toBe(0);

    const miss = searchCatalog(ITEMS, { q: 'pozolo' }, 'en');
    expect(miss.total).toBe(1);
    expect(miss.usedFuzzy).toBe(true);

    const many: SearchableRecipe[] = Array.from({ length: 30 }, (_, i) => ({
      id: `id${i}`,
      slug: `slug-${i}`,
      title: `Recipe ${i}`,
      country: 'us',
      lang: 'en',
      ingredients: 'water',
    }));
    const p1 = searchCatalog(many, { page: 1 }, 'en');
    const p2 = searchCatalog(many, { page: 2 }, 'en');
    expect(p1.pageSize ?? SEARCH_PAGE_SIZE).toBe(24);
    expect(p1.items).toHaveLength(24);
    expect(p2.items).toHaveLength(6);
    expect(p2.totalPages).toBe(2);
  });

  it('returns grouped suggestions for header typeahead', () => {
    const sug = suggestCatalog(ITEMS, 'pot', 'en', (r) => `/${r.country}/recipes/${r.slug}`);
    expect(sug.recipes.some((r) => r.id === 'r3')).toBe(true);
    expect(sug.ingredients).toContain('potatoes');
    const catSug = suggestCatalog(ITEMS, 'soup', 'en', (r) => `/${r.country}/recipes/${r.slug}`);
    expect(catSug.categories.some((c) => c.href === '/recipes/soups-stews')).toBe(true);
  });
});
