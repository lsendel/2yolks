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

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: { sources, recipes, recipeLocales, recipeImages } });
}
