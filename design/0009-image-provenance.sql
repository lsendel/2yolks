-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 11: per-image provenance, required by approved module C2 ("Photo
-- provenance is always required: my own photos / AI illustration / from
-- another source, which asks whose permission you have"). NULL means not yet
-- declared; an images-scope grant refuses while any bound image is NULL.
-- provenance_note is mandatory when provenance = 'other' (whose permission).

ALTER TABLE recipe_images
  ADD COLUMN provenance TEXT CHECK (provenance IN ('own', 'ai', 'other'));

ALTER TABLE recipe_images
  ADD COLUMN provenance_note TEXT;
