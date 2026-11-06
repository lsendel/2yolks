/**
 * scripts/backfill-categories.mjs
 * Backfills primary category taxonomy across all 2yolks recipes in D1.
 */
export const CATEGORY_BACKFILL = {
  // Published recipes
  'cd58d192': 'desserts-baking', // Brown Butter Cardamom Chocolate Chip Cookies
  '2ba6d505': 'desserts-baking', // Pumpkin Roll with Cream Cheese Filling
  'c1d9c3b4': 'desserts-baking', // One-Bowl Cinnamon Apple Cake
  'cff0c3a1': 'drinks',          // Hot Toddy
  '5c479942': 'drinks',          // Mulled Wine
  '4e23e226': 'drinks',          // Ponche navideño
  '22d307a4': 'snacks-dips',     // Seven-Layer Taco Dip
  'd86e1582': 'snacks-dips',     // Jalapeño Cranberry Dip
  'b9e37a49': 'snacks-dips',     // Mini Burger Bites
  'e9bc7550': 'breakfast',       // Barbecue Spam and Egg Onigiri
  '24558bf7': 'mains',           // Slow-Cooker Butter Chicken
  'd9c38b20': 'mains',           // Air Fryer Turkey Breast
  '4108063b': 'tacos-tortillas', // Crispy Beef Tacos with Cilantro-Lime Sauce
  '200abf28': 'sides',           // Make-Ahead Mashed Potatoes
  '1c048512': 'sides',           // Tzatziki Pasta Salad
  '6e2a61f5': 'sides',           // Greek Salad
  '3ab80574': 'soups-stews',     // Slow-Cooker Lasagna Soup
  'cf769ca1': 'soups-stews',     // Creamy Chicken and Wild Rice Soup
  'w1birria': 'tacos-tortillas',
  'w1enchiladas': 'tacos-tortillas',
  'w1golumpki': 'soups-stews',
  'w1potsticker': 'dumplings',
  'w1pozole': 'soups-stews',

  // Drafts
  '074ef1e9': 'desserts-baking',
  '0a1655c2': 'mains',
  '173fe3cc': 'mains',
  '1867f697': 'mains',
  '22862fe8': 'sides',
  '3791784d': 'sides',
  '38b23a02': 'mains',
  '42e16f96': 'desserts-baking',
  '432b359b': 'mains',
  '48456ea7': 'snacks-dips',
  '4c1da41c': 'breakfast',
  '529b69f6': 'snacks-dips',
  '5d0526ce': 'mains',
  '6919d48d': 'soups-stews',
  '748068a5eb': 'mains',
  '7865b479': 'tacos-tortillas',
  '7e5b9ea2': 'desserts-baking',
  '8349b2c2': 'mains',
  '8d56cf37': 'breakfast',
  '9214e255': 'sides',
  '977d4124': 'snacks-dips',
  '97ebf246': 'snacks-dips',
  'b34cad72': 'snacks-dips',
  'b589d46a': 'snacks-dips',
  'be94af13': 'desserts-baking',
  'c5d80a41': 'desserts-baking',
  'd42e85ed': 'drinks',
  'e5f27e28': 'mains',
  'e6a40058': 'desserts-baking',
  'ea9e175a': 'desserts-baking',
  'f0f1e78a': 'snacks-dips',
  'f3598b9b': 'desserts-baking',
  'f471c08f': 'breakfast',
};

export function generateBackfillSql() {
  const stmts = [];
  for (const [id, cat] of Object.entries(CATEGORY_BACKFILL)) {
    stmts.push(`UPDATE recipes SET category = '${cat}' WHERE id = '${id}';`);
  }
  return stmts.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  console.log(generateBackfillSql());
}
