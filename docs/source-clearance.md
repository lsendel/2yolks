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
- Open checks: myplate.gov terms page and robots.txt UNVERIFIED - the site
  is unreachable from every available egress path (web_fetch CRAWL_TIMEOUT
  x3; cloud-browser proxy 502 provider_unreachable; workspace DNS fails),
  Nov 1, 2026. Harvester fails closed on robots fetch errors, so MyPlate
  items cannot qualify until the site becomes reachable and both checks
  pass. Deprioritized per "do not wait on MyPlate" guidance.

## USDA department-wide copyright statement - RECORDED (not per-item clearance)
- https://www.usda.gov/policies-and-links "Digital Rights and Copyright"
  (fetched Nov 1, 2026): "Most information presented on the USDA Web site
  is considered public domain information ... Some materials ... are
  protected by copyright ... USDA has made every attempt to identify and
  clearly label them." Basis: department statement + 17 U.S.C. 105. The
  "most" + labeled-exceptions wording means every candidate item still
  needs an individual check for labeling/attribution notices.

## USDA FNS Team Nutrition (fns.usda.gov/tn/recipes) - CANDIDATE, mixed authorship
- robots.txt fetched Nov 1, 2026: standard Drupal rules; /tn/ paths not
  disallowed for user-agent *. Terms page not yet located on fns.usda.gov
  (/copyright and /usda-website-policies-and-important-links both 404).
- Rights basis is NOT uniform: the school recipes were "developed by state
  child nutrition agencies" under FY2021 Team Nutrition Training Grants
  (fns.usda.gov/tn/recipes, fetched Nov 1, 2026) - state-agency works are
  not federal works and 17 U.S.C. 105 does not apply. Standardized recipes
  have moved to the Institute of Child Nutrition (University of
  Mississippi, a federal contractor) - separate rights again.
- Consequence: FNS items qualify only per-item where the rights basis
  resolves to a federal employee work or an explicit license; state/ICN
  items need their own clearance and are not assumed.


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

## Mexico-native candidates - investigated Nov 1, 2026

### vidasaludable.gob.mx/recetarios - BARRED by default (portal terms)
- Rich Mexico-native government collection: SEP (Recetario del Frijol),
  SNDIF (Regionalizado de Alimentacion Escolar, Refrigerios Saludables),
  Secretaria de Salud (Recetario Regional), plus one UNICEF recetario
  (third-party rights). Locale fit: native Mexican Spanish, regional.
- Terms: gob.mx portal terms (https://www.gob.mx/terminos, fetched Nov 1,
  2026) grant "solamente para su uso personal y no para un uso comercial"
  and forbid modification, reproduction, public display, and transfer.
  That bars these recetarios for this commercial site BY DEFAULT.
- Per-document license checks (Nov 1, 2026): three candidate recetario
  PDFs fetched and scanned for rights statements - DIF "Recetario
  Regionalizado de Alimentacion Escolar Modalidad Caliente 2025"
  (vidasaludable.gob.mx direct PDF), SEP "Recetario del Frijol Vive
  Saludable", and cultura.gob.mx "Sabores Mexico 21Dic". NONE carries a
  license, copyright notice, or reproduction grant in its text. That
  establishes no permission found for these documents - not proof that the
  portal terms legally govern each PDF (link-specific applicability is
  unverified). With no permissive basis at either level, the conservative
  do-not-harvest hold stands for all three.
- robots.txt unreachable from our fetch path (CRAWL_UNKNOWN_ERROR). Do not
  harvest; revisit only if a per-document license appears or written
  clearance is obtained.

### cultura.gob.mx "Recetario: Sabores Mexico" - TERMS UNVERIFIED
- Site refuses our fetch path (HTTP 444). Federal cultural-ministry
  publication; gob.mx default terms apply unless the PDF states otherwise.
  Same default-barred posture as above.

### Mexico sourcing conclusion (Nov 1, 2026)
- No cleared Mexico-native source found among the sources checked:
  gob.mx-hosted recetarios are barred by the portal's non-commercial
  terms, three specific recetario PDFs (DIF 2025, SEP frijol, Sabores
  Mexico) carry no permissive statement, and datos.gob.mx surfaces no
  recetario dataset. Search is bounded, not exhaustive: state-level leads
  (state DIF/secretariat sites with their own terms) remain to finish,
  then unresolved clearance gets summarized and work moves on. Candidate
  paths: (a) per-document permissive licenses, (b) state-level terms,
  (c) written clearance requests (needs Luis's approval - no outreach
  without it).
