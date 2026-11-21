-- Migration 0013: reviewer feedback for user-submitted recipes (S8 status timeline).
--
-- recipe_locales.status keeps its meaning (draft | published | rejected) and
-- stays the only thing public pages and the MCP publish gate read. The
-- review lifecycle of a user submission lives on recipes:
--   review_status  NULL           = never sent in (private draft) or not a user recipe
--                  'in_review'    = sent in, waiting for an admin (submitted_at set, editing locked)
--                  'needs_changes'= admin asked for changes (submitted_at cleared, editable, re-send needs attestation)
--                  'declined'     = admin declined (locale status 'rejected', stays visible to the author)
--                  'published'    = admin published through recipes.publish
--   review_note    reviewer note (needs_changes) or reason (declined); NULL for legacy rows
--   reviewed_at / reviewed_by  server-stamped from the authenticated MCP key, never caller content
--   removed_by_user_at  the author removed the draft themselves (hidden from My kitchen);
--                  distinct from an admin decline, which never sets it
--   notify_lang    account UI language (en|es|fr) at send-in time, for the author's notices
--   review_notice / review_notice_at  outcome of the author notice for the latest transition:
--                  'sent' | 'skipped_budget' | 'skipped_no_mail' | 'failed'
-- Additive only. Nothing is deleted.
ALTER TABLE recipes ADD COLUMN review_status TEXT CHECK (review_status IS NULL OR review_status IN ('in_review', 'needs_changes', 'declined', 'published'));
ALTER TABLE recipes ADD COLUMN review_note TEXT;
ALTER TABLE recipes ADD COLUMN reviewed_at TEXT;
ALTER TABLE recipes ADD COLUMN reviewed_by TEXT;
ALTER TABLE recipes ADD COLUMN removed_by_user_at TEXT;
ALTER TABLE recipes ADD COLUMN notify_lang TEXT;
ALTER TABLE recipes ADD COLUMN review_notice TEXT CHECK (review_notice IS NULL OR review_notice IN ('sent', 'skipped_budget', 'skipped_no_mail', 'failed'));
ALTER TABLE recipes ADD COLUMN review_notice_at TEXT;
CREATE INDEX IF NOT EXISTS idx_recipes_review_status ON recipes(review_status);

-- Backfill (user recipes only; MCP-created recipes keep NULL).
-- Before 0013 the account "Remove" set the locale to 'rejected', and it only
-- worked while submitted_at IS NULL. A rejected locale on an UNSUBMITTED user
-- recipe is therefore a user removal: it stays hidden.
UPDATE recipes SET removed_by_user_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE owner_user_id IS NOT NULL AND submitted_at IS NULL AND removed_by_user_at IS NULL
  AND EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = recipes.id AND l.status = 'rejected');
-- Anything live is 'published' (checked first: live wins over any other locale state).
UPDATE recipes SET review_status = 'published'
WHERE owner_user_id IS NOT NULL AND review_status IS NULL
  AND EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = recipes.id AND l.status = 'published');
-- A rejected locale on a SUBMITTED user recipe could only come from an admin:
-- it becomes 'declined' with no note (the old decision carried none).
UPDATE recipes SET review_status = 'declined'
WHERE owner_user_id IS NOT NULL AND submitted_at IS NOT NULL AND review_status IS NULL
  AND EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = recipes.id AND l.status = 'rejected');
UPDATE recipes SET review_status = 'in_review'
WHERE owner_user_id IS NOT NULL AND submitted_at IS NOT NULL AND review_status IS NULL;
