# Source clearance ledger

Every recipe row carries a source; a source feeds `published` rows only after
its rights review is recorded here (source + license + date + evidence URL).
`cleared_at` stays NULL until then, and the serving gates keep such rows
invisible. Status values: CLEARED / CANDIDATE / RESTRICTED / DEV-ONLY.

## USDA FoodData Central (nutrition data) - CLEARED for API use
- US federal government data; free api.data.gov key.
- Scope: nutrition panel enrichment only, not recipe text.
- Plan-verified Nov 1, 2026.

## USDA MyPlate Kitchen (recipes, EN + ES) - CANDIDATE, needs site-terms confirmation
- MyPlate Kitchen is published by USDA FNS/CNPP. US federal government works
  are public domain under 17 U.S.C. 105; the National Agricultural Library's
  copyright statement confirms "most information... is in the public domain"
  for USDA sites (https://www.nal.usda.gov/web-policies-and-important-links,
  fetched Nov 1, 2026).
- Recipe text and nutrition are federal work. Photography is NOT cleared:
  site photos may be contractor work with separate rights - never harvest
  images from MyPlate pages.
- Spanish recipe pages exist (https://www.myplate.gov/es/recipes/...), which
  fits the US/Mexico wave-1 native sample set.
- Open checks before any bulk run: myplate.gov's own terms page and
  robots.txt (both timed out via our fetch path Nov 1, 2026 - verify directly
  with the harvester, which fails closed on robots fetch errors). Until
  recorded here, pilot fetches are private format samples only.

## TheMealDB - DEV-ONLY
- Free test key is for development only; recipes credit other sites.
- Single private format sample permitted by plan; not a seed corpus.

## PantryAtlas (CC-BY-NC-4.0) - RESTRICTED
- Non-commercial clause: barred for this business site and its seed corpus
  without separate written clearance from the licensor.
- Internal evaluation only if its license permits that use.

## UGC (2yolks cooks) - CLEARED by submission flow design
- Submitter grants rights at submission time (form copy pending auth gate);
  rows enter as drafts, publish after review.
