-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 11: per-image provenance and sealed digests. Plan module C2 asks where
-- every image comes from (own photos / AI illustration / another source +
-- whose permission). Provenance is part of the canonical snapshot, and
-- therefore of the hash consent binds, and of the sealed revision manifest.
-- On the live table these columns are draft working state and become
-- immutable once the image is bound to a revision.

ALTER TABLE recipe_images
  ADD COLUMN provenance TEXT CHECK (provenance IN ('own', 'ai', 'other'));

ALTER TABLE recipe_images
  ADD COLUMN provenance_note TEXT;

-- Digest of the exact R2 bytes, filled by the image pipeline. NULL = not yet
-- hashed; undigested images are excluded from snapshots and an images-scope
-- grant refuses while any current image lacks a digest.
ALTER TABLE recipe_images
  ADD COLUMN sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64);

ALTER TABLE recipe_revision_images
  ADD COLUMN provenance TEXT CHECK (provenance IN ('own', 'ai', 'other'));

ALTER TABLE recipe_revision_images
  ADD COLUMN provenance_note TEXT;

-- Bound-image immutability for the REV 11 columns (the 0007 no-update trigger
-- predates them), with a fill-in-once ratchet: a field can be DECLARED once
-- (NULL -> value, e.g. the image pipeline sealing a digest, or the cook
-- declaring provenance before an images-scope grant), but once a field holds
-- a value, binding makes it immutable. Any mutation still changes the
-- canonical hash, so a newer snapshot never matches an older grant.
CREATE TRIGGER recipe_images_bound_no_provenance_update BEFORE UPDATE OF provenance, provenance_note, sha256 ON recipe_images
WHEN EXISTS (SELECT 1 FROM recipe_revision_images m WHERE m.image_id = OLD.id) AND (
  (OLD.provenance IS NOT NULL AND IFNULL(NEW.provenance, '') <> IFNULL(OLD.provenance, ''))
  OR (OLD.provenance_note IS NOT NULL AND IFNULL(NEW.provenance_note, '') <> IFNULL(OLD.provenance_note, ''))
  OR IFNULL(NEW.sha256, '') <> IFNULL(OLD.sha256, ''))
BEGIN
  SELECT RAISE(ABORT, 'an image bound to a revision is immutable');
END;
