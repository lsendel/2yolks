import type { RecipeCategorySlug } from './index';
import { categoryLabel } from './index';

export const SEARCH_PAGE_SIZE = 24;
export const MAX_HOME_ITEMS = 24;

export const DIET_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;
export type DietTag = (typeof DIET_TAGS)[number];
export function isDietTag(v: unknown): v is DietTag {
  return typeof v === 'string' && (DIET_TAGS as readonly string[]).includes(v);
}

export const TIME_BUCKETS = ['15', '30', '60', '60plus'] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];
export function isTimeBucket(v: unknown): v is TimeBucket {
  return typeof v === 'string' && (TIME_BUCKETS as readonly string[]).includes(v);
}

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'project'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];
export function isDifficultyLevel(v: unknown): v is DifficultyLevel {
  return typeof v === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(v);
}

export const COLLECTION_SLUGS = ['weeknight', 'thanksgiving', 'no-oven', 'quick', 'vegetarian'] as const;
export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];
export function isCollectionSlug(v: unknown): v is CollectionSlug {
  return typeof v === 'string' && (COLLECTION_SLUGS as readonly string[]).includes(v);
}

export interface SearchableRecipe {
  id: string;
  slug: string;
  title: string;
  country: string;
  lang: string;
  originCountry?: string | null;
  untested?: boolean;
  category?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  intro?: string | null;
  ingredients?: string | null;
  diets?: DietTag[];
  difficulty?: DifficultyLevel | null;
  noOven?: boolean;
}

export interface SearchQuery {
  q?: string;
  cat?: string | null;
  time?: TimeBucket | null;
  diet?: DietTag | null;
  cuisine?: string | null;
  difficulty?: DifficultyLevel | null;
  tested?: boolean;
  method?: 'no-oven' | null;
  have?: readonly string[] | null;
  page?: number;
  pageSize?: number;
}

export interface PantryMatchInfo {
  matched: string[];
  matchCount: number;
  requestedCount: number;
}

export interface SearchResult<T extends SearchableRecipe = SearchableRecipe> {
  items: T[];
  allMatched: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  usedFuzzy: boolean;
  suggestions: T[];
  unfilteredCount: number;
  activeFilterCount: number;
  pantryMatches?: Record<string, PantryMatchInfo>;
}

export interface SuggestCategoryHit {
  kind: 'category' | 'collection';
  slug: string;
  href: string;
  label: string;
}

export interface SuggestResult {
  recipes: { id: string; title: string; href: string; category: string | null; totalMinutes: number | null }[];
  categories: SuggestCategoryHit[];
  ingredients: string[];
}

// ---------------------------------------------------------------------------
// Text normalization, edit distance & token matching
// ---------------------------------------------------------------------------

export function normSearchText(s: string): string {
  return (s || '')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'oe')
    .replace(/\u00e6/g, 'ae')
    .replace(/\u00df/g, 'ss')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array<number>(b.length + 1);
  const v1 = new Array<number>(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j]! + 1, v0[j + 1]! + 1, v0[j]! + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]!;
  }
  return v0[b.length]!;
}

function tokenVariants(tok: string): string[] {
  const v = [tok];
  if (tok.length > 3) {
    if (tok.endsWith('ies')) v.push(tok.slice(0, -3) + 'y');
    else if (tok.endsWith('es')) v.push(tok.slice(0, -2), tok.slice(0, -1));
    else if (tok.endsWith('s')) v.push(tok.slice(0, -1));
    else v.push(tok + 's', tok + 'es');
  }
  return v;
}

function matchToken(tok: string, text: string, fuzzy: boolean): boolean {
  if (!tok || !text) return false;
  if (text.includes(tok)) return true;
  for (const variant of tokenVariants(tok)) {
    if (text.includes(variant)) return true;
  }
  if (fuzzy && tok.length >= 5) {
    const maxD = tok.length >= 8 ? 2 : 1;
    const words = text.split(/[^a-z0-9]+/);
    for (const w of words) {
      if (w.length >= 4 && Math.abs(w.length - tok.length) <= maxD) {
        if (editDistance(tok, w) <= maxD) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Honest deterministic classification: diets, no-oven method & difficulty
// Never authoritative medical advice; UI always displays the inferred caveat.
// ---------------------------------------------------------------------------

const PLANT_COMPOUNDS_RE =
  /\b(?:coconut milk|leche de coco|lait de coco|coconut cream|crema de coco|creme de coco|almond milk|leche de almendras?|lait d'amande|oat milk|leche de avena|lait d'avoine|soy milk|leche de soya|leche de soja|lait de soja|vegan butter|plant butter|vegan cheese|queso vegano|fromage vegan|peanut butter|mantequilla de (?:mani|cacahuate)|crema de cacahuate|beurre de cacahuete|almond butter|cashew butter|sunflower seed butter|cocoa butter|manteca de cacao|beurre de cacao|cream of tartar|cremor tartaro|creme de tartre|butternut squash|butternut|eggplant|aubergine|corn tortillas?|tortillas? de maiz|masa harina|harina de maiz|farine de mais|rice noodles?|fideos de arroz|nouilles de riz|almond flour|harina de almendras?|poudre d'amande|coconut flour|harina de coco|rice flour|harina de arroz|farine de riz|oat flour|chickpea flour|garbanzo flour|harina de garbanzo|farine de pois chiche|gluten[-\s]?free flour|harina sin gluten|farine sans gluten|gluten[-\s]?free pasta|gluten[-\s]?free bread|gluten[-\s]?free oats|tamari|cauliflower rice|nutritional yeast|levadura nutricional|levure nutritionnelle)\b/g;

const MEAT_RE =
  /\b(?:beef|res|boeuf|pork|cerdo|porc|chicken|pollo|poulet|turkey|pavo|dinde|lamb|cordero|agneau|veal|ternera|veau|duck|pato|canard|goose|ganso|oie|venison|bison|bacon|tocino|tocineta|lardons?|ham|jamon|jambon|sausage|salchicha|chorizo|longaniza|saucisse|andouille|prosciutto|pancetta|pepperoni|salami|mortadella|pastrami|steak|filete|costillas?|ribs?|chops?|chuletas?|wings?|alitas?|drumsticks?|muslos? de pollo|pechuga|tenderloin|sirloin|brisket|carnitas|birria|machaca|chicharron|meatballs?|albondigas?|ground meat|carne|viande|shrimp|camarones?|crevettes?|prawns?|crab|cangrejo|crabe|lobster|langosta|homard|fish|pescado|poisson|salmon|tuna|atun|thon|cod|bacalao|morue|tilapia|trout|trucha|truite|snapper|halibut|anchov(?:y|ies)|anchoas?|anchois|sardines?|clams?|almejas?|palourdes?|mussels?|mejillones?|moules?|oysters?|ostras?|huitres?|scallops?|vieiras?|squid|calamares?|calmar|octopus|pulpo|poulpe|gelatin|gelatina|gelatine|lard|manteca de cerdo|saindoux|tallow|suet|chicken broth|beef broth|pork broth|bone broth|chicken stock|beef stock|fish sauce|salsa de pescado|sauce poisson|oyster sauce|salsa de ostion|sauce huitre|worcestershire|caldo de (?:pollo|res|cerdo|pescado|camaron|hueso|carne)|bouillon de (?:volaille|boeuf|poulet|porc|poisson|viande|os))\b/;

const DAIRY_RE =
  /\b(?:milk|leche|lait|butter|mantequilla|beurre|cheese|queso|fromage|cheddar|mozzarella|parmesan|parmesano|parmigiano|feta|ricotta|brie|gouda|cotija|queso fresco|panelas?|oaxaca|asadero|manchego|pecorino|gruyere|provolone|monterey jack|colby|muenster|mascarpone|paneer|halloumi|burrata|cream|crema|creme|half[\s-]+and[\s-]+half|heavy cream|whipping cream|sour cream|crema acida|creme fraiche|yogurt|yogur|yaourt|buttermilk|suero de leche|babeurre|whey|casein|ghee|ice cream|helado|glace|condensed milk|leche condensada|lait concentre|evaporated milk|leche evaporada|kefir|requeson)\b/;

const EGG_HONEY_RE =
  /\b(?:eggs?|huevos?|oeufs?|yolks?|yemas?|jaunes? d'oeuf|egg whites?|claras?|blancs? d'oeuf|mayo|mayonnaise|mayonesa|honey|miel)\b/;

const GLUTEN_RE =
  /\b(?:flour|harina|farine|wheat|trigo|ble|breadcrumbs?|pan molido|pan rallado|chapelure|panko|rebanadas? de pan|pan blanco|pan dulce|pan integral|pan tostado|bolillo|telera|pain de mie|baguette|ciabatta|brioche|focaccia|pita|naan|pasta|spaghetti|espagueti|macaroni|macarrones|penne|fusilli|fettuccine|linguine|rigatoni|lasagna|lasana|rotini|orzo|tagliatelle|noodles?|fideos?|nouilles?|udon|ramen|couscous|cuscus|bulgur|farro|semolina|semola|semoule|barley|cebada|orge|rye|centeno|seigle|spelt|espelta|epeautre|seitan|soy sauce|salsa de soya|salsa de soja|sauce soja|teriyaki|hoisin|malt|malta|beer|cerveza|biere|crackers?|galletas?|biscuits?|croutons?|picatostes?|puff pastry|hojaldre|pate feuilletee|pie crust|masa de empanada|flour tortillas?|tortillas? de harina|dumpling wrappers?|wonton wrappers?|gyoza wrappers?|pretzels?)\b/;

export function inferDiets(ingredientsText: string | null | undefined): DietTag[] {
  if (!ingredientsText || !ingredientsText.trim()) return [];
  const clean = normSearchText(ingredientsText).replace(PLANT_COMPOUNDS_RE, ' ');
  // Guard English baking/cooking "pan" phrase just in case cookware sneaks into ingredients.
  const noCookwarePan = clean
    .replace(/\bpan[-\s]+(?:fry|fried|frying|sear|seared|roast|roasted|grease|sheet)\b/g, ' ')
    .replace(/\b(?:baking|sheet|roasting|frying|cake|loaf|muffin|springform|cast[-\s]+iron)[-\s]+pan\b/g, ' ');
  const panBread = /\b(?:pan|pain)\b/.test(noCookwarePan);

  const hasMeat = MEAT_RE.test(clean);
  const hasDairy = DAIRY_RE.test(clean);
  const hasEggHoney = EGG_HONEY_RE.test(clean);
  const hasGluten = GLUTEN_RE.test(clean) || panBread;

  const out: DietTag[] = [];
  if (!hasMeat) out.push('vegetarian');
  if (!hasMeat && !hasDairy && !hasEggHoney) out.push('vegan');
  if (!hasGluten) out.push('gluten-free');
  if (!hasDairy) out.push('dairy-free');
  return out;
}

export function inferNoOven(title: string, intro: string | null | undefined, stepsText: string | null | undefined): boolean {
  const head = normSearchText(`${title} ${intro ?? ''}`);
  if (/\b(?:no[-\s]?bake|sin horno|sans cuisson|sans four)\b/.test(head)) return true;
  if (!stepsText || !stepsText.trim()) return false;
  const body = normSearchText(stepsText);
  if (
    /\b(?:oven|horno|hornear|horneado|hornea|preheat|precalienta|precalentar|prechauffer|four|cuire au four|broil|broiler|gratinar|enfourner|baking sheet|baking dish|charola para hornear|molde para hornear)\b/.test(
      body,
    )
  ) {
    return false;
  }
  const temps = [...stepsText.matchAll(/\{t:(\d+(?:\.\d+)?)([FC])\}/gi)];
  for (const m of temps) {
    const val = Number(m[1]);
    const scale = m[2]!.toUpperCase();
    if ((scale === 'F' && val >= 250 && val <= 550) || (scale === 'C' && val >= 120 && val <= 290)) {
      return false;
    }
  }
  return true;
}

export function effectiveTotalMinutes(r: {
  totalMinutes?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
}): number | null {
  if (typeof r.totalMinutes === 'number' && r.totalMinutes > 0) return r.totalMinutes;
  const prep = typeof r.prepMinutes === 'number' && r.prepMinutes > 0 ? r.prepMinutes : 0;
  const cook = typeof r.cookMinutes === 'number' && r.cookMinutes > 0 ? r.cookMinutes : 0;
  const sum = prep + cook;
  return sum > 0 ? sum : null;
}

export function inferDifficulty(input: {
  totalMinutes?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  stepsCount?: number;
  ingredientsCount?: number;
}): DifficultyLevel | null {
  const mins = effectiveTotalMinutes(input);
  const steps = input.stepsCount ?? 0;
  const ings = input.ingredientsCount ?? 0;
  if (mins == null && steps === 0 && ings === 0) return null;
  if ((mins != null && mins > 90) || steps >= 12 || ings >= 16) return 'project';
  if ((mins == null || mins <= 35) && steps <= 6 && ings <= 10) return 'easy';
  return 'medium';
}

export function matchesTimeBucket(
  recipe: { totalMinutes?: number | null; prepMinutes?: number | null; cookMinutes?: number | null },
  bucket: TimeBucket,
): boolean {
  const mins = effectiveTotalMinutes(recipe);
  if (mins == null) return false;
  if (bucket === '15') return mins <= 15;
  if (bucket === '30') return mins <= 30;
  if (bucket === '60') return mins <= 60;
  return mins > 60;
}

// ---------------------------------------------------------------------------
// Localized category, collection & cuisine metadata
// ---------------------------------------------------------------------------

export const CATEGORY_INTROS: Readonly<Record<RecipeCategorySlug, { en: string; es: string; fr: string }>> = {
  'soups-stews': {
    en: 'Simmered broths, pozoles, chowders, and cozy pots built for bowls and crusty bread.',
    es: 'Caldos, pozoles, cremas y guisos de olla pensados para servir bien calientes.',
    fr: 'Bouillons mijotés, potages et ragoûts généreux à déguster bien chauds.',
  },
  dumplings: {
    en: 'Folded dough pockets, potstickers, pierogi, and steamed parcels from crisp-bottomed to tender.',
    es: 'Masas rellenas, potstickers, empanadillas y raviolis al vapor o dorados al sartén.',
    fr: 'Raviolis pliés, gyozas grillés et bouchées farcies à cuire à la poêle ou à la vapeur.',
  },
  'tacos-tortillas': {
    en: 'Crisp and soft tortilla plates, enchiladas, chilaquiles, birria, and street-style fillings.',
    es: 'Tacos suaves o dorados, enchiladas, chilaquiles, birria y rellenos para tortilla.',
    fr: 'Tacos croustillants ou moelleux, enchiladas, birria et garnitures pour tortillas.',
  },
  'desserts-baking': {
    en: 'Warm cookies, fruit crisps, custards, cakes, and sweet bakes with clear oven temperatures and yields.',
    es: 'Galletas, pays, pasteles, flanes y postres dulces con temperaturas y porciones claras.',
    fr: 'Biscuits, tartes, gâteaux, crèmes et pâtisseries avec températures et portions précises.',
  },
  drinks: {
    en: 'Spiced punches, aguas frescas, warm mugs, and house pours written cleanly step by step.',
    es: 'Bebidas calientes, ponches especiados, aguas frescas y tragos escritos paso a paso.',
    fr: 'Boissons chaudes aux épices, infusions glacées et cocktails expliqués pas à pas.',
  },
  breakfast: {
    en: 'Eggs, griddles, toasts, chilaquiles, and morning plates that respect weekday schedules.',
    es: 'Huevos, desayunos de sartén, pan tostado y platos de mañana sin complicaciones.',
    fr: 'Œufs, pains dorés, chilaquiles et petits-déjeuners rapides ou du week-end.',
  },
  mains: {
    en: 'Centerpiece skillet, sheet-pan, and slow-cooked mains with clear portions and timing.',
    es: 'Platos fuertes de sartén, horno o estufa con tiempos y porciones honestas.',
    fr: 'Plats principaux à la poêle, au four ou mijotés avec temps et portions fiables.',
  },
  sides: {
    en: 'Salads, mashed roots, roasted greens, rice, and everyday companions that round out dinner.',
    es: 'Ensaladas, purés, vegetales rostizados y acompañamientos para completar cualquier comida.',
    fr: 'Salades, purées, légumes rôtis et accompagnements pour compléter chaque repas.',
  },
  'snacks-dips': {
    en: 'Salsas, spreads, crispy bites, and table snacks ready to share in minutes.',
    es: 'Salsas, botanas crujientes, dips y bocados listos para compartir al centro.',
    fr: 'Salsas, trempettes, bouchées croustillantes et apéritifs à partager.',
  },
};

export interface CollectionMeta {
  slug: CollectionSlug;
  icon: string;
  title: { en: string; es: string; fr: string };
  intro: { en: string; es: string; fr: string };
}

export const COLLECTIONS: Readonly<Record<CollectionSlug, CollectionMeta>> = {
  weeknight: {
    slug: 'weeknight',
    icon: 'clock',
    title: {
      en: 'Weeknight dinners',
      es: 'Cenas entre semana',
      fr: 'Dîners de semaine',
    },
    intro: {
      en: 'Everyday mains, tacos, soups, and dumplings ready in 45 minutes or less — or easy low-effort staples.',
      es: 'Platos fuertes, tacos y sopas prácticas de 45 minutos o menos para cocinar cualquier día.',
      fr: 'Plats principaux, tacos et soupes prêts en 45 minutes ou moins pour les soirs de semaine.',
    },
  },
  thanksgiving: {
    slug: 'thanksgiving',
    icon: 'sides',
    title: {
      en: 'Thanksgiving & harvest table',
      es: 'Mesa de otoño y fiesta',
      fr: 'Table d’automne et fêtes',
    },
    intro: {
      en: 'Holiday casseroles, sweet potatoes, pies, warm spiced drinks, and hearty sides made for passing around the table.',
      es: 'Cazuelas de fiesta, camote, pays, bebidas especiadas y guarniciones para compartir en mesa grande.',
      fr: 'Gratins de fête, patates douces, tartes, boissons épicées et accompagnements conviviaux.',
    },
  },
  'no-oven': {
    slug: 'no-oven',
    icon: 'cook',
    title: {
      en: 'No-oven & stovetop',
      es: 'Sin horno',
      fr: 'Sans four',
    },
    intro: {
      en: 'Skillet suppers, simmered pots, no-bake sweets, and fresh salads cooked without heating up an oven.',
      es: 'Recetas de sartén, olla o sin cocción para cocinar sin encender el horno.',
      fr: 'Recettes à la poêle, mijotées ou sans cuisson pour cuisiner sans allumer le four.',
    },
  },
  quick: {
    slug: 'quick',
    icon: 'prep',
    title: {
      en: '30 minutes or less',
      es: 'En 30 minutos o menos',
      fr: 'En 30 minutes ou moins',
    },
    intro: {
      en: 'Quick breakfasts, weeknight plates, salads, and drinks that go from prep to table in half an hour or under.',
      es: 'Desayunos, platos rápidos, ensaladas y bebidas listas en media hora o menos.',
      fr: 'Petits-déjeuners, plats rapides, salades et boissons prêts en une demi-heure maximum.',
    },
  },
  vegetarian: {
    slug: 'vegetarian',
    icon: 'check',
    title: {
      en: 'Vegetarian cooking',
      es: 'Cocina vegetariana',
      fr: 'Cuisine végétarienne',
    },
    intro: {
      en: 'Recipes built without meat, poultry, or seafood — inferred from listed ingredients; check individual lines for dietary needs.',
      es: 'Recetas sin carne, aves ni mariscos según los ingredientes listados; revisa cada línea ante alergias.',
      fr: 'Recettes sans viande, volaille ni fruits de mer selon les ingrédients indiqués ; vérifiez toujours la liste complète.',
    },
  },
};

const HARVEST_RE =
  /\b(?:thanksgiving|harvest|holiday|autumn|turkey|pavo|dinde|stuffing|relleno|cranberr(?:y|ies)|arandanos?|canneberges?|sweet potato(?:es)?|camote|patate douce|pumpkin|calabaza|citrouille|potiron|pecan|noix de pecan|mashed potato(?:es)?|pure de papas?|puree de pommes de terre|gravy|casserole|apple pie|pecan pie|cornbread|mulled wine|vino caliente|vin chaud)\b/;

export function matchesCollection(r: SearchableRecipe, slug: CollectionSlug): boolean {
  const mins = effectiveTotalMinutes(r);
  if (slug === 'quick') return mins != null && mins <= 30;
  if (slug === 'no-oven') return Boolean(r.noOven);
  if (slug === 'vegetarian') return Array.isArray(r.diets) && r.diets.includes('vegetarian');
  if (slug === 'thanksgiving') {
    const text = normSearchText(`${r.title} ${r.intro ?? ''} ${r.ingredients ?? ''}`);
    return HARVEST_RE.test(text);
  }
  // weeknight
  if (r.category === 'desserts-baking' || r.category === 'drinks') return false;
  if (mins != null) return mins <= 45;
  return r.difficulty === 'easy';
}

export interface CuisineMeta {
  slug: string;
  codes: readonly string[];
  title: { en: string; es: string; fr: string };
  intro: { en: string; es: string; fr: string };
  marketCountry?: string;
}

export const CUISINES: Readonly<Record<string, CuisineMeta>> = {
  mexican: {
    slug: 'mexican',
    codes: ['mx'],
    marketCountry: 'mx',
    title: { en: 'Mexican', es: 'Mexicana', fr: 'Mexicaine' },
    intro: {
      en: 'Pozole, birria, chilaquiles, enchiladas, and home-style Mexican cooking with clear chiles, yields, and metric measures.',
      es: 'Pozole, birria, chilaquiles, enchiladas y cocina casera mexicana con cantidades claras.',
      fr: 'Pozole, birria, chilaquiles, enchiladas et cuisine familiale mexicaine expliqués étape par étape.',
    },
  },
  american: {
    slug: 'american',
    codes: ['us'],
    marketCountry: 'us',
    title: { en: 'American', es: 'Estadounidense', fr: 'Américaine' },
    intro: {
      en: 'Skillet suppers, cookies, holiday casseroles, and everyday classics cooked in American home kitchens.',
      es: 'Cenas de sartén, galletas, cazuelas y clásicos caseros de la cocina estadounidense.',
      fr: 'Plats à la poêle, cookies, gratins de fête et grands classiques de la cuisine américaine.',
    },
  },
  polish: {
    slug: 'polish',
    codes: ['pl'],
    title: { en: 'Polish', es: 'Polaca', fr: 'Polonaise' },
    intro: {
      en: 'Cabbage soups, pierogi, and comforting Central European classics written in plain kitchen terms.',
      es: 'Sopas de col, pierogi y clásicos reconfortantes de la cocina polaca.',
      fr: 'Soupes au chou, pierogi et grands classiques réconfortants de la cuisine polonaise.',
    },
  },
  chinese: {
    slug: 'chinese',
    codes: ['cn'],
    title: { en: 'Chinese', es: 'China', fr: 'Chinoise' },
    intro: {
      en: 'Potstickers, stir-fries, noodles, and home-style dishes with clear prep and skillet timing.',
      es: 'Potstickers, salteados, fideos y platos caseros de inspiración china.',
      fr: 'Raviolis grillés, sautés et plats familiaux de tradition chinoise.',
    },
  },
  italian: {
    slug: 'italian',
    codes: ['it'],
    title: { en: 'Italian', es: 'Italiana', fr: 'Italienne' },
    intro: {
      en: 'Pastas, sauces, braises, and simple pantry dishes grounded in traditional Italian technique.',
      es: 'Pastas, salsas, estofados y platos sencillos de técnica italiana.',
      fr: 'Pâtes, sauces, mijotés et plats du placard inspirés de la cuisine italienne.',
    },
  },
  french: {
    slug: 'french',
    codes: ['fr'],
    title: { en: 'French', es: 'Francesa', fr: 'Française' },
    intro: {
      en: 'Bistro stews, tarts, gratins, and pastry basics written without jargon.',
      es: 'Guisos de bistró, tartas, gratinados y bases francesas sin rodeos.',
      fr: 'Mijotés de bistrot, tartes, gratins et classiques français expliqués simplement.',
    },
  },
  greek: {
    slug: 'greek',
    codes: ['gr'],
    title: { en: 'Greek', es: 'Griega', fr: 'Grecque' },
    intro: {
      en: 'Bright herb salads, yogurt dips, lemony roasts, and Mediterranean staples.',
      es: 'Ensaladas frescas con hierbas, salsas de yogur y clásicos mediterráneos.',
      fr: 'Salades fraîches aux herbes, sauces au yaourt et classiques grecs.',
    },
  },
  german: {
    slug: 'german',
    codes: ['de'],
    title: { en: 'German', es: 'Alemana', fr: 'Allemande' },
    intro: {
      en: 'Crisp cutlets, braised cabbage, potato salads, and hearty bakehouse favorites.',
      es: 'Escalopes crujientes, ensaladas de papa y clásicos caseros alemanes.',
      fr: 'Escalopes croustillantes, salades de pommes de terre et classiques allemands.',
    },
  },
  spanish: {
    slug: 'spanish',
    codes: ['es'],
    title: { en: 'Spanish', es: 'Española', fr: 'Espagnole' },
    intro: {
      en: 'Tortillas, stews, garlic-and-olive-oil classics, and relaxed table plates.',
      es: 'Tortillas, guisos y platos tradicionales de la cocina española.',
      fr: 'Tortillas, mijotés et classiques conviviaux de la cuisine espagnole.',
    },
  },
  british: {
    slug: 'british',
    codes: ['uk', 'gb'],
    title: { en: 'British', es: 'Británica', fr: 'Britannique' },
    intro: {
      en: 'Roasts, traybakes, pies, and cozy pantry puddings.',
      es: 'Asados, pasteles salados y clásicos reconfortantes de cocina británica.',
      fr: 'Rôtis, tourtes et desserts réconfortants de tradition britannique.',
    },
  },
  canadian: {
    slug: 'canadian',
    codes: ['ca'],
    title: { en: 'Canadian', es: 'Canadiense', fr: 'Canadienne' },
    intro: {
      en: 'Maple bakes, comforting soups, and regional Canadian home staples.',
      es: 'Horneados con maple, sopas y clásicos canadienses.',
      fr: 'Pâtisseries à l’érable, soupes et classiques canadiens.',
    },
  },
};

export function resolveCuisineSlug(slugOrCode: string | null | undefined): string | null {
  if (!slugOrCode) return null;
  const raw = slugOrCode.trim().toLowerCase();
  if (CUISINES[raw]) return raw;
  for (const [slug, meta] of Object.entries(CUISINES)) {
    if (meta.codes.includes(raw)) return slug;
  }
  return null;
}

export function effectiveOriginCode(r: Pick<SearchableRecipe, 'originCountry' | 'country'>): string {
  return (r.originCountry || r.country || '').trim().toLowerCase();
}

export function matchesCuisine(r: Pick<SearchableRecipe, 'originCountry' | 'country'>, slugOrCode: string): boolean {
  const slug = resolveCuisineSlug(slugOrCode);
  if (!slug) return false;
  const meta = CUISINES[slug];
  if (!meta) return false;
  return meta.codes.includes(effectiveOriginCode(r));
}

export function availableCuisines(
  rows: ReadonlyArray<Pick<SearchableRecipe, 'originCountry' | 'country'>>,
  lang: string,
): { slug: string; label: string; count: number; marketCountry?: string }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const slug = resolveCuisineSlug(effectiveOriginCode(r));
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';
  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      label: CUISINES[slug]!.title[l],
      count,
      marketCountry: CUISINES[slug]!.marketCountry,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// Filtering, search ranking, suggestions & pagination (shared SSR + suggest API)
// ---------------------------------------------------------------------------

function passesStructuredFilters(r: SearchableRecipe, q: SearchQuery): boolean {
  if (q.cat && r.category !== q.cat) return false;
  if (q.time && !matchesTimeBucket(r, q.time)) return false;
  if (q.diet && (!Array.isArray(r.diets) || !r.diets.includes(q.diet))) return false;
  if (q.cuisine && !matchesCuisine(r, q.cuisine)) return false;
  if (q.difficulty && r.difficulty !== q.difficulty) return false;
  if (q.tested && r.untested !== false) return false;
  if (q.method === 'no-oven' && !r.noOven) return false;
  return true;
}

function scoreMatches<T extends SearchableRecipe>(
  rows: readonly T[],
  tokens: string[],
  rawQNorm: string,
  lang: string,
  fuzzy: boolean,
): { rec: T; tier: number; idx: number }[] {
  const out: { rec: T; tier: number; idx: number }[] = [];
  rows.forEach((rec, idx) => {
    const title = normSearchText(rec.title);
    const cat = normSearchText(categoryLabel(rec.category, lang) ?? '');
    const cuisineSlug = resolveCuisineSlug(effectiveOriginCode(rec));
    const cuisineLabel = cuisineSlug ? normSearchText(CUISINES[cuisineSlug]!.title[lang === 'es' || lang === 'fr' ? lang : 'en']) : '';
    const body = normSearchText(`${rec.ingredients ?? ''} ${rec.intro ?? ''}`);

    let titleMatchesAll = true;
    let catOrCuisineAny = false;
    for (const tok of tokens) {
      const inTitle = matchToken(tok, title, fuzzy);
      const inCat = matchToken(tok, cat, fuzzy) || (cuisineLabel ? matchToken(tok, cuisineLabel, fuzzy) : false);
      const inBody = matchToken(tok, body, false);
      if (!inTitle && !inCat && !inBody) return;
      if (!inTitle) titleMatchesAll = false;
      if (inCat) catOrCuisineAny = true;
    }
    let tier = titleMatchesAll ? 1 : catOrCuisineAny ? 2 : 3;
    if (title === rawQNorm || title.startsWith(rawQNorm + ' ')) tier = 0;
    out.push({ rec, tier, idx });
  });
  out.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.idx - b.idx));
  return out;
}

export const MAX_PANTRY_ITEMS = 5;

export interface PantryStaple {
  key: string;
  label: { en: string; es: string; fr: string };
  synonyms: readonly string[];
}

export const PANTRY_STAPLES: readonly PantryStaple[] = [
  { key: 'eggs', label: { en: 'Eggs', es: 'Huevos', fr: 'Oeufs' }, synonyms: ['egg', 'eggs', 'huevo', 'huevos', 'oeuf', 'oeufs'] },
  { key: 'chicken', label: { en: 'Chicken', es: 'Pollo', fr: 'Poulet' }, synonyms: ['chicken', 'pollo', 'poulet'] },
  { key: 'rice', label: { en: 'Rice', es: 'Arroz', fr: 'Riz' }, synonyms: ['rice', 'arroz', 'riz'] },
  { key: 'garlic', label: { en: 'Garlic', es: 'Ajo', fr: 'Ail' }, synonyms: ['garlic', 'ajo', 'ail'] },
  { key: 'tomatoes', label: { en: 'Tomatoes', es: 'Tomates', fr: 'Tomates' }, synonyms: ['tomato', 'tomatoes', 'tomate', 'tomates', 'jitomate', 'jitomates'] },
  { key: 'onion', label: { en: 'Onion', es: 'Cebolla', fr: 'Oignon' }, synonyms: ['onion', 'onions', 'cebolla', 'cebollas', 'oignon', 'oignons'] },
  { key: 'potatoes', label: { en: 'Potatoes', es: 'Papas', fr: 'Pommes de terre' }, synonyms: ['potato', 'potatoes', 'papa', 'papas', 'patata', 'patatas', 'pomme de terre', 'pommes de terre'] },
  { key: 'beans', label: { en: 'Beans', es: 'Frijoles', fr: 'Haricots' }, synonyms: ['bean', 'beans', 'frijol', 'frijoles', 'haricot', 'haricots'] },
  { key: 'pasta', label: { en: 'Pasta', es: 'Pasta', fr: 'Pates' }, synonyms: ['pasta', 'spaghetti', 'noodles', 'fideos', 'pates'] },
  { key: 'cheese', label: { en: 'Cheese', es: 'Queso', fr: 'Fromage' }, synonyms: ['cheese', 'queso', 'fromage', 'cheddar', 'mozzarella', 'parmesan', 'cotija'] },
  { key: 'lemon', label: { en: 'Lemon / Lime', es: 'Limon', fr: 'Citron' }, synonyms: ['lemon', 'lime', 'limon', 'lima', 'citron'] },
  { key: 'spinach', label: { en: 'Spinach', es: 'Espinacas', fr: 'Epinards' }, synonyms: ['spinach', 'espinaca', 'espinacas', 'epinard', 'epinards'] },
];

export function parseHaveParam(raw: string | readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((chunk) => String(chunk).split(','))
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s.length >= 2 && s.length <= 32 && /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9\s'-]*$/.test(s));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parts) {
    const k = normSearchText(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= MAX_PANTRY_ITEMS) break;
  }
  return out;
}

function pantryTermsFor(item: string): string[] {
  const norm = normSearchText(item);
  if (!norm) return [];
  const staple = PANTRY_STAPLES.find(
    (s) => s.key === norm || s.synonyms.some((syn) => normSearchText(syn) === norm),
  );
  if (!staple) return [norm];
  const terms = new Set<string>([norm, ...staple.synonyms.map((s) => normSearchText(s))]);
  return [...terms].filter(Boolean);
}

export function searchCatalog<T extends SearchableRecipe>(
  rows: readonly T[],
  query: SearchQuery,
  lang: string,
): SearchResult<T> {
  const rawQ = (query.q ?? '').trim();
  const qNorm = normSearchText(rawQ);
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(60, query.pageSize) : SEARCH_PAGE_SIZE;
  const requestedPage = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const haveItems = parseHaveParam(query.have ?? undefined);

  const activeFilterCount =
    (query.cat ? 1 : 0) +
    (query.time ? 1 : 0) +
    (query.diet ? 1 : 0) +
    (query.cuisine ? 1 : 0) +
    (query.difficulty ? 1 : 0) +
    (query.tested ? 1 : 0) +
    (query.method ? 1 : 0);

  const filtered = activeFilterCount > 0 ? rows.filter((r) => passesStructuredFilters(r, query)) : [...rows];
  let matched: T[] = [];
  let usedFuzzy = false;
  let unfilteredCount = 0;
  let pantryMatches: Record<string, PantryMatchInfo> | undefined;

  if (!qNorm) {
    matched = filtered;
  } else {
    const tokens = qNorm.split(/\s+/).filter(Boolean);
    let scored = scoreMatches(filtered, tokens, qNorm, lang, false);
    if (scored.length === 0) {
      scored = scoreMatches(filtered, tokens, qNorm, lang, true);
      usedFuzzy = scored.length > 0;
    }
    matched = scored.map((m) => m.rec);
    if (matched.length === 0 && activeFilterCount > 0) {
      const fullExact = scoreMatches(rows, tokens, qNorm, lang, false);
      const full = fullExact.length > 0 ? fullExact : scoreMatches(rows, tokens, qNorm, lang, true);
      unfilteredCount = full.length;
    }
  }

  if (haveItems.length > 0) {
    const minNeed = haveItems.length === 1 ? 1 : 2;
    const rankedPantry: { rec: T; matchedList: string[]; ingCount: number; idx: number }[] = [];
    matched.forEach((rec, idx) => {
      const hay = normSearchText(`${rec.ingredients ?? ''} ${rec.title}`);
      const hitList: string[] = [];
      for (const item of haveItems) {
        const terms = pantryTermsFor(item);
        if (terms.some((term) => matchToken(term, hay, false))) hitList.push(item);
      }
      if (hitList.length >= minNeed) {
        const ingCount = normSearchText(rec.ingredients ?? '').split(/\s+/).filter(Boolean).length;
        rankedPantry.push({ rec, matchedList: hitList, ingCount, idx });
      }
    });
    rankedPantry.sort((a, b) =>
      b.matchedList.length !== a.matchedList.length
        ? b.matchedList.length - a.matchedList.length
        : a.ingCount !== b.ingCount
          ? a.ingCount - b.ingCount
          : a.idx - b.idx,
    );
    pantryMatches = {};
    for (const entry of rankedPantry) {
      pantryMatches[entry.rec.id] = {
        matched: entry.matchedList,
        matchCount: entry.matchedList.length,
        requestedCount: haveItems.length,
      };
    }
    matched = rankedPantry.map((e) => e.rec);
  }

  let suggestions: T[] = [];
  if (matched.length === 0 && qNorm) {
    const ranked: { rec: T; dist: number }[] = [];
    for (const r of rows) {
      let minD = 999;
      for (const w of normSearchText(r.title).split(/[^a-z0-9]+/)) {
        if (!w) continue;
        const d = editDistance(qNorm, w);
        if (d < minD) minD = d;
      }
      if (minD <= 3) ranked.push({ rec: r, dist: minD });
    }
    ranked.sort((a, b) => a.dist - b.dist || a.rec.title.localeCompare(b.rec.title));
    suggestions = ranked.slice(0, 3).map((x) => x.rec);
  }

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (requestedPage - 1) * pageSize;
  const items = matched.slice(start, start + pageSize);

  return {
    items,
    allMatched: matched,
    total,
    page: requestedPage,
    pageSize,
    totalPages,
    usedFuzzy,
    suggestions,
    unfilteredCount,
    activeFilterCount,
    ...(pantryMatches ? { pantryMatches } : {}),
  };
}

export function suggestCatalog<T extends SearchableRecipe>(
  rows: readonly T[],
  rawQ: string,
  lang: string,
  recipeHref: (r: T) => string,
): SuggestResult {
  const qNorm = normSearchText(rawQ);
  const lq = lang === 'es' || lang === 'fr' ? `?lang=${lang}` : '';
  const l = lang === 'es' || lang === 'fr' ? lang : 'en';

  if (!qNorm) {
    return { recipes: [], categories: [], ingredients: [] };
  }

  const searchRes = searchCatalog(rows, { q: rawQ, page: 1, pageSize: 5 }, lang);
  const recipes = searchRes.items.map((r) => ({
    id: r.id,
    title: r.title,
    href: recipeHref(r),
    category: categoryLabel(r.category, lang),
    totalMinutes: effectiveTotalMinutes(r),
  }));

  const categories: SuggestCategoryHit[] = [];
  const seenCat = new Set<string>();
  for (const r of rows) {
    if (!r.category || seenCat.has(r.category)) continue;
    const lbl = categoryLabel(r.category, lang);
    if (!lbl) continue;
    if (normSearchText(lbl).includes(qNorm) || normSearchText(r.category).includes(qNorm)) {
      seenCat.add(r.category);
      categories.push({ kind: 'category', slug: r.category, href: `/recipes/${r.category}${lq}`, label: lbl });
      if (categories.length >= 3) break;
    }
  }
  if (categories.length < 3) {
    for (const slug of COLLECTION_SLUGS) {
      const lbl = COLLECTIONS[slug].title[l];
      if (normSearchText(lbl).includes(qNorm) || slug.includes(qNorm)) {
        categories.push({ kind: 'collection', slug, href: `/collections/${slug}${lq}`, label: lbl });
        if (categories.length >= 3) break;
      }
    }
  }

  const ingCounts = new Map<string, number>();
  const tok = qNorm.split(/\s+/)[0] ?? qNorm;
  for (const r of rows) {
    const words = normSearchText(r.ingredients ?? '').split(/[^a-z0-9]+/);
    const matchedWords = new Set<string>();
    for (const w of words) {
      if (w.length >= 3 && w.startsWith(tok)) matchedWords.add(w);
    }
    for (const w of matchedWords) {
      ingCounts.set(w, (ingCounts.get(w) ?? 0) + 1);
    }
  }
  const ingredients = [...ingCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([w]) => w);

  return { recipes, categories, ingredients };
}

/** Extract the first timer duration in whole minutes from a step string (ignoring 0). */
export function extractStepMinutes(stepText?: string | null): number | null {
  if (!stepText) return null;
  const m = /\b(\d{1,3})\s*(min(?:ute)?s?|minutos?|hours?|horas?|heures?)\b/i.exec(stepText);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]!.toLowerCase();
  return unit.startsWith('h') ? n * 60 : n;
}

// ---------------------------------------------------------------------------
// S4 Structured ingredient builder & S12 Search-gap prompt sanitizer
// ---------------------------------------------------------------------------

export interface CaptureIngredientRow {
  isSection: boolean;
  qty: string;
  unit: string;
  item: string;
}

const CAPTURE_UNITS = new Set([
  'g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l', 'oz', 'lb', 'lbs',
  'cup', 'cups', 'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'tsp', 'tsps', 'teaspoon', 'teaspoons',
  'taza', 'tazas', 'cda', 'cdas', 'cucharada', 'cucharadas',
  'cdta', 'cdtas', 'cucharadita', 'cucharaditas',
  'tasse', 'tasses',
  'pinch', 'pinches', 'pizca', 'pizcas', 'pincee',
  'clove', 'cloves', 'diente', 'dientes', 'gousse', 'gousses',
  'can', 'cans', 'lata', 'latas',
  'slice', 'slices', 'piece', 'pieces', 'pieza', 'piezas',
  'bunch', 'manojo', 'sprig', 'sprigs', 'rama', 'ramas',
]);

const LEADING_QTY_RE =
  /^\s*((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[\u00BC-\u00BE\u2150-\u215E])(?:\s*[-\u2013]\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[\u00BC-\u00BE\u2150-\u215E]))?)\s*(.*)$/;

export function parseCaptureIngredientRow(line: string): CaptureIngredientRow {
  const cleaned = (line ?? '').replace(/^\s*(?:[-*\u2022\u00B7]\s+)/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { isSection: false, qty: '', unit: '', item: '' };
  if (!LEADING_QTY_RE.test(cleaned)) {
    const sec = /^(?:#+\s*(.+?)\s*|\[(.+?)\]|([A-Za-z\u00C0-\u024F][^0-9,;]{1,48}):)$/.exec(cleaned);
    if (sec) {
      const heading = (sec[1] ?? sec[2] ?? sec[3] ?? '').replace(/:+$/, '').trim();
      if (heading) return { isSection: true, qty: '', unit: '', item: heading };
    }
  }
  const qm = LEADING_QTY_RE.exec(cleaned);
  if (!qm) return { isSection: false, qty: '', unit: '', item: cleaned };
  const qty = qm[1]!.replace(/\s+/g, ' ').trim();
  let rest = (qm[2] ?? '').trim();
  let unit = '';
  const um = /^([A-Za-z\u00C0-\u024F]+)\.?(?=\s|$)\s*(.*)$/.exec(rest);
  if (um && CAPTURE_UNITS.has(normSearchText(um[1]!))) {
    unit = um[1]!;
    rest = (um[2] ?? '').trim().replace(/^of\s+/i, '');
  }
  return { isSection: false, qty, unit, item: rest };
}

export function formatCaptureIngredientRow(row: CaptureIngredientRow): string {
  const item = (row.item ?? '').replace(/\s+/g, ' ').trim();
  if (row.isSection) {
    const h = item.replace(/:+$/, '').trim();
    return h ? `${h}:` : '';
  }
  return [row.qty.trim(), row.unit.trim(), item].filter(Boolean).join(' ');
}

export function sanitizeSearchGapPrompt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 48) return null;
  if (/(?:https?:|www\.|\.(?:com|org|net|io)\b)/i.test(s)) return null;
  if (/^\d+$/.test(s)) return null;
  if (!/[aeiouáéíóúàèìòùâêîôûäëïöüyœæ]/i.test(s)) return null;
  if (!/^[A-Za-z\u00C0-\u024F0-9][A-Za-z\u00C0-\u024F0-9\s'-]{1,46}[A-Za-z\u00C0-\u024F0-9]$/.test(s)) return null;
  return s;
}

export function titleCasePrompt(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
