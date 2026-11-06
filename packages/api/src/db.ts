import { eq, and, ne, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  license: text('license').notNull(),
  clearedAt: text('cleared_at'),
  notes: text('notes'),
});

/** A rights stamp counts only when it is a non-empty string - the same rule
 * the /img/recipe endpoint applies with its truthiness check. Using one
 * predicate everywhere keeps the list, the recipe page and the binary
 * endpoint consistent: NULL and '' both mean "recorded, not cleared". */
export const imageCleared = () => and(isNotNull(recipeImages.clearedAt), ne(recipeImages.clearedAt, ''));


export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => sources.id),
  originCountry: text('origin_country'),
  imageKey: text('image_key'),
  createdAt: text('created_at').notNull(),
  testedAt: text('tested_at'),
  testedBy: text('tested_by'),
  prepMinutes: integer('prep_minutes'),
  cookMinutes: integer('cook_minutes'),
  restMinutes: integer('rest_minutes'),
  totalMinutes: integer('total_minutes'),
  baseServings: real('base_servings'),
  category: text('category'),
  ownerUserId: text('owner_user_id'),
  submittedAt: text('submitted_at'),
  attestedAt: text('attested_at'),
  authorName: text('author_name'),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
});

export const recipeImages = sqliteTable(
  'recipe_images',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    kind: text('kind', { enum: ['hero', 'step'] }).notNull(),
    stepIndex: integer('step_index'),
    r2Key: text('r2_key').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    style: text('style', { enum: ['photo', 'illustration', 'graphic'] }).notNull(),
    sourceName: text('source_name').notNull(),
    sourceUrl: text('source_url').notNull(),
    license: text('license').notNull(),
    clearedAt: text('cleared_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_recipe_images_recipe').on(t.recipeId)],
);

export const recipeLocales = sqliteTable(
  'recipe_locales',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    country: text('country').notNull(),
    lang: text('lang').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    intro: text('intro'),
    ingredientsJson: text('ingredients_json').notNull(),
    stepsJson: text('steps_json').notNull(),
    status: text('status', { enum: ['draft', 'published', 'rejected'] })
      .notNull()
      .default('draft'),
    translationOf: text('translation_of'),
    translationMethod: text('translation_method'),
    translationReviewedAt: text('translation_reviewed_at'),
    translationReviewedBy: text('translation_reviewed_by'),
    translationReviewerKind: text('translation_reviewer_kind'),
  },
  (t) => [
    primaryKey({ columns: [t.country, t.lang, t.slug] }),
    index('idx_recipe_locales_recipe').on(t.recipeId),
    index('idx_recipe_locales_country').on(t.country, t.lang, t.status),
  ],
);

export const recipeSlugAliases = sqliteTable(
  'recipe_slug_aliases',
  {
    country: text('country').notNull(),
    lang: text('lang').notNull(),
    slug: text('slug').notNull(),
    recipeId: text('recipe_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.country, t.lang, t.slug] })],
);

export const searchGapLogs = sqliteTable(
  'search_gap_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    query: text('query').notNull(),
    locale: text('locale').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_search_gap_logs_created').on(t.createdAt)],
);

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: { users, sources, recipes, recipeLocales, recipeImages, recipeSlugAliases, searchGapLogs } });
}

const DEMO_LICENSE = 'internal-demo';

/** Published-row predicate: requires a cleared source (license reviewed),
 * and excludes synthetic demo-seed rows unless ALLOW_DEMO_SEED=true
 * (local dev only). This is a production serving gate, not noindex.
 * Shared by the HTML routes (index.ts) and the native app JSON API (appapi.ts). */
export function published(db: ReturnType<typeof createDb>, allowDemo: boolean) {
  const conds = [
    eq(recipeLocales.status, 'published'),
    // clearedAt NULL means the source rights review has not completed.
    isNotNull(sources.clearedAt),
  ];
  if (!allowDemo) conds.push(ne(sources.license, DEMO_LICENSE));
  return and(...conds);
}
