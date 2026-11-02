# Source clearance ledger

Every recipe row carries a source; a source feeds `published` rows only after
a rights review is recorded here. A bulk harvest run is proposed only after
the source row below shows CLEARED. `cleared_at` stays NULL until then and
the serving gates keep such rows invisible.

Clearance requires, per source AND per item used:
1. rights basis (who authored the recipe text; federal employment vs
   contractor/third-party is per-item, not per-site);
2. attribution required by the license, if any, recorded exactly;
3. media exclusion (photos/videos are never cleared by text rights);
4. locale/country fit for the target market (a Spanish translation of a US
   agency recipe is not Mexico-native content; wave-1 sample sets must be
   natively appropriate per the directory launch rule);
5. robots.txt status (allows the harvester) and the site's own terms page
   (permits reuse) - robots allowance is not a license grant, and neither
   alone is clearance.

Status values: CLEARED / CANDIDATE / RESTRICTED / DEV-ONLY.

## USDA FoodData Central (nutrition data) - CLEARED for API use
- US federal government data; free api.data.gov key.
- Scope: nutrition panel enrichment only, not recipe text.
- Plan-verified Nov 1, 2026.

## USDA MyPlate Kitchen - CANDIDATE (per-item review not yet done)
- Federal-work hypothesis: MyPlate Kitchen is published by USDA FNS/CNPP and
  US federal employee works are public domain (17 U.S.C. 105; NAL copyright
  statement fetched Nov 1, 2026,
  https://www.nal.usda.gov/web-policies-and-important-links). This does NOT
  establish that every recipe is a federal employee work: contractor and
  third-party contributions exist on federal sites, so each candidate item
  needs its own rights check before use.
- Photos/videos: excluded from any clearance; never harvest MyPlate media.
- Locale fit: pages exist in English and Spanish, but a USDA Spanish
  translation is US content in Spanish - it does not satisfy the Mexico
  native sample-set rule by itself. Candidate for the US sample set pending
  per-item rights; Mexico set still needs natively sourced recipes.
- Open checks: myplate.gov terms page and robots.txt (our fetch path timed
  out twice Nov 1, 2026; the harvester fails closed on robots fetch errors
  and will record the result). Private format-sample fetch only if both
  permit; no bulk run, no publication.

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

## Per-item register
Columns: item URL | rights basis | attribution | media excluded | locale fit | robots | terms | decision.
Empty - first entries arrive with the MyPlate private pilot review.
