# Private family phase1, draft foundation only

Owner approval: Luis accepted1-3 on23 Nov2026,1:27ET after the1:20ET ask:
- draft code only, no database change, release or cost;
- owner/admin/member roles, admin-approved joins, accepted improved recipes shared with selected family;
- one recipe-source photo plus one dish photo,3MB each; abandoned drafts cleaned after30days.

This branch is isolated from the unpushed native-search branch. Its base is
93d31d16466a38052cd57aa48fd937220fa402f8. No dependency changes.

## What is implemented

Pure domain transitions with snapshot copying, plus a transaction-interface service for exact-version acceptance and private reads: submission, review, exact-version
owner acceptance, withdrawal, family reads filtering out source photos, admin
join approval and membership removal. Version/consent/revision checks, per-image
and pending quota checks, principal/request-bound receipt replay, and a disabled
30day abandoned-draft eligibility predicate. Domain/service tests run locally only. Service tests use a fake transaction, not a persisted atomicity proof.

Neither enablement flag is connected to an environment variable. Both are false.
There are no routes, schedulers, mail sends, DB/R2 writes or public media promotion.
`schema-proposal.sql` is a review spec outside the migration directory, not an
executed migration. It must not be run yet.

## What is NOT done

This is not the full implementation and not deployable functionality:
- no authenticated web/native route adapters or finished UI;
- no persisted transactions, concurrent membership CAS or durable receipts;
- no actual blob upload, image re-encoding/EXIF stripping, cleanup or erasure job;
- no production schema inventory, migration/backfill, staging or deployment;
- no native compile/simulator qualification and no full end-to-end visual proof.

The future adapter must derive authenticated principals and reviewer grants,
recompute canonical version/request digests server-side, CAS revision and
membership inside the accept/share transaction, and reserve quota atomically.
A pure function returning success is NOT evidence of a stored share or upload.

Private media must stay behind current-membership checks with private/no-store
responses and no public object keys. A recipe-source image is review-only, never
a family cover. The improved structured recipe and rights-cleared dish cover are
the accepted family version. Existing public publication/rights rules stay separate.

## Remaining authority and gates

No backend push/PR until the separate owner approval requested by main. No hosted
CI or dispatch, no spend, no notifications, no staging, production DB changes,
release or TestFlight. Gates4-6 from the implementation plan remain unapproved.
New30day retention is disabled pending legal/privacy review plus a separately
approved migration/deployment and tested cleanup/erasure paths. The7day rejected
media proposal was not in the short owner ask and is not implemented.

Manual-review load is not yet measured. Recipe-photo text is manually corrected
before owner acceptance; automatic OCR/models/voice remain deferred. Retain
existing account behavior and never infer public publication from family approval.
