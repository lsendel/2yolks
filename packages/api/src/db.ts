import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';

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
});

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
  },
  (t) => [
    primaryKey({ columns: [t.country, t.lang, t.slug] }),
    index('idx_recipe_locales_recipe').on(t.recipeId),
    index('idx_recipe_locales_country').on(t.country, t.lang, t.status),
  ],
);

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: { sources, recipes, recipeLocales } });
}
