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
  reviewStatus: text('review_status', { enum: ['in_review', 'needs_changes', 'declined', 'published'] }),
  reviewNote: text('review_note'),
  reviewedAt: text('reviewed_at'),
  reviewedBy: text('reviewed_by'),
  removedByUserAt: text('removed_by_user_at'),
  notifyLang: text('notify_lang'),
  reviewNotice: text('review_notice', { enum: ['sent', 'skipped_budget', 'skipped_no_mail', 'failed'] }),
  reviewNoticeAt: text('review_notice_at'),
});

/** Community kitchen-test reports (migration 0008). A report is a moderation
 * queue row only: it never changes what the site shows by itself. An admin
 * approves it through the MCP and only then is recipes.tested_at/tested_by
 * stamped. Rejected reports are hidden, never deleted. */
export const recipeTestReports = sqliteTable(
  'recipe_test_reports',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    note: text('note'),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: text('created_at').notNull(),
    moderatedAt: text('moderated_at'),
    moderatedBy: text('moderated_by'),
    imageR2Key: text('image_r2_key'),
    imageMime: text('image_mime'),
    imageBytes: integer('image_bytes'),
    imageWidth: integer('image_width'),
    imageHeight: integer('image_height'),
    imageId: text('image_id'),
  },
  (t) => [index('idx_test_reports_status').on(t.status, t.createdAt)],
);

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  zelutoContactId: text('zeluto_contact_id'),
  zelutoOrgId: text('zeluto_org_id'),
  zelutoConnectionStatus: text('zeluto_connection_status').notNull().default('not_registered'),
  marketingOptIn: integer('marketing_opt_in').notNull().default(1),
  unsubscribedAt: text('unsubscribed_at'),
  createdAt: text('created_at').notNull(),
});

export const creatorSubscribers = sqliteTable('creator_subscribers', {
  id: text('id').primaryKey(),
  creatorUserId: text('creator_user_id').notNull().references(() => users.id),
  subscriberUserId: text('subscriber_user_id').notNull().references(() => users.id),
  zelutoContactId: text('zeluto_contact_id'),
  zelutoPushedAt: text('zeluto_pushed_at'),
  unsubscribedAt: text('unsubscribed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export async function hasUserSharedRecipe(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM recipes WHERE owner_user_id = ? AND (submitted_at IS NOT NULL OR review_status IS NOT NULL) LIMIT 1')
    .bind(userId)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

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

/** Optional contributor cover photo attached to a private draft (migration 0012). */
export const draftPhotos = sqliteTable(
  'draft_photos',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    r2Key: text('r2_key').notNull(),
    mime: text('mime', { enum: ['image/jpeg', 'image/png', 'image/webp'] }).notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: text('created_at').notNull(),
    moderatedAt: text('moderated_at'),
    moderatedBy: text('moderated_by'),
    imageId: text('image_id'),
  },
  (t) => [index('idx_draft_photos_user').on(t.userId, t.status)],
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

export const savedRecipes = sqliteTable(
  'saved_recipes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.recipeId] }),
    index('idx_saved_recipes_user').on(t.userId, t.createdAt),
  ],
);

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: { users, creatorSubscribers, savedRecipes, sources, recipes, recipeLocales, recipeImages, draftPhotos, recipeSlugAliases, searchGapLogs, recipeTestReports } });
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
