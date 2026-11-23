# Private media: rights, consent and encoding decision

Draft research and design, November 23, 2026. No package, account change, schema run, service activation or deployment. Feature and retention flags stay false. This document does not turn a consent checkbox into verified copyright ownership or legal advice.

## Recommended direction

Use immutable, version-bound attestations and acceptance records, and keep raw uploads out of storage. Prefer Cloudflare's byte-stream Images binding only if the existing account can use Images Free without upgrading, automatic overage or paid-plan exposure, and metadata removal can be explicitly configured and tested through that binding. Otherwise evaluate a bundled JPEG/PNG/WebP WASM codec offline after a dependency proposal. Do not quietly fall back to a public transformation URL, raw storage or a paid service.

Neither encoder candidate is qualified yet. Native/browser preprocessing is useful for upload size and UX, but never replaces server-side validation of hostile uploads. The existing R2 binding is named IMAGES, so an Images binding must use a distinct name such as PRIVATE_IMAGE_ENCODER, not overwrite the bucket binding.

## Rights and consent persistence strategy

### Separate facts, not one boolean

Store an immutable attestation with: server-generated ID, authenticated principal, candidate ID, immutable version ID and canonical server-computed version digest, sanitized-media ID and digest, explicit purpose (recipe_source or dish_cover), policy text/version and digest, server timestamp and account/session generation reference. Record distinct assertions for permission to upload for private review, permission to share a dish cover with the selected family, and acceptance of an exact improved recipe. Never infer public-publication permission or a transferable copyright license from family acceptance. A role grants access, not authorship or rights. Do not put tokens, photo bytes, EXIF, raw user agent or unnecessary IP history in audit rows.

A recipe-source image is private review material. It must not be promoted into a family cover, search result, analytics payload or public image table. The contributor sees it; a currently authorized reviewer may see it only while assigned to that review. Family admins/members do not acquire source access by managing membership. A family cover must bind a rights attestation to the exact sanitized object/version, not a reusable media ID whose bytes can change.

### Proposed write order

1. Authenticate the session on the server, enforce exact origin for cookie writes and a principal-bound operation key. Validate the request and policy versions before any costly decode or storage operation. Parse bounded image headers before full decode to reject oversized dimensions; a 3 MB input can expand far beyond Worker memory.
2. Atomically reserve one slot per purpose and account pending-byte quota. Bind the reservation to candidate revision, family revision and membership revision, plus a short expiry proposal. Rights/private-review consent must be present and version-bound. Reservation is never readable. Quota includes reserved/deleting slots and is not released on an unknown bucket outcome.
3. Decode into pixels, apply orientation, reject animation or explicitly flatten it, re-encode into a fresh allowed container, remove metadata, enforce output size and compute a server digest. Do not retain raw bytes or log rejected content. Complete this before R2 put. Recheck candidate/membership/reservation before put and again at finalization.
4. Write to an immutable server-owned private key. CAS-finalize the verified slot and its rights attestation only if all revision/consent checks still hold. The catalog/R2 boundary is a saga, not a cross-service transaction. On unknown outcome retain a non-readable reservation, reconcile the same operation key, and do not blindly overwrite/delete a possibly committed object.
5. Review creates a new immutable improved version with a server-computed canonical digest. A change to text, cover, locale or rights association invalidates the prior preview. Contributor acceptance binds principal, exact version/digest, selected family, family/membership revision and consent-policy version. In the same atomic boundary bind the share and principal/request receipt. Never share merely because a reviewer clicked approve.
6. Read accepted family content only after current membership and non-withdrawn/non-erasing share checks. Serve only the accepted improved text and rights-cleared dish cover, no source photo. Recheck authorization after object read. Responses are private/no-store and nosniff, with no public bucket/CDN URL or bearer capability that outlives membership.

### Revocation, withdrawal and erasure

Membership removal, withdrawal and owner erase must win or lose against acceptance/read finalization through the same revision/CAS boundary. Mark access revoked/deleting first, then delete the private object, then acknowledge completion and release quota. Failed deletion retains a resumable tombstone and denies reads. Do not claim erasure complete from a failed or unknown R2 response. Deduplicate no private objects across owners/families in this phase; sharing ownership makes deletion ambiguous.

An account-deletion plan must enumerate candidate versions, source/cover slots, family shares, unresolved operations and audit references without publishing private text. Minimal audit retention and the behavior of recipes already shared with family require privacy/legal review. Do not silently retain source photos forever or erase every audit row just because the object was deleted. Existing account-deletion routes must not be wired to these drafts until their outcomes and failure recovery are tested.

### Current code gaps

The catalog has restrictive owner-only draft reads, not accepted-cover or reviewer reads. It does not yet persist rights/policy attestations or CAS all required revisions. Its SQL tests inspect statement construction, not executed D1 behavior. The aggregate acceptance design and normalized schema proposal are alternatives, not a single approved schema. A single row can atomically bind acceptance and receipt, but all membership/review/withdrawal writers must use its CAS, with bounded size and no unbounded embedded history. Rights and receipt growth require an explicit retention/compaction design, not an automatic pruning timer.

No new retention schedule is active. Thirty-day abandoned-draft cleanup was approved only as a draft policy and remains disabled pending legal/privacy review. A proposed upload-reservation expiry is not covered by that policy and needs review before activation. The seven-day rejected-media proposal was not in the owner ask.

### Required acceptance tests before wiring

- Independent ownership/private-review and family-cover attestations, tampered policy/digest/version/principal and expired-session refusal.
- Duplicate acceptance and unknown responses, concurrent membership removal, withdrawal, cover replacement, reviewer reassignment and account deletion.
- Purpose and pending-byte reservations racing on actual chosen D1 persistence, exact SQL compatibility, rollback/CAS losers and durable operation reconciliation.
- R2 put/finalize/delete timeouts at every boundary, orphan discovery without public enumeration, tombstone resumption and no wrong-object deletion.
- Real metadata fixtures containing GPS/EXIF/XMP/IPTC, orientation variants, ICC profiles, animation, polyglots, truncation and decompression bombs. Inspect resulting bytes independently; sanitizer metadataRemoved=true is not evidence.
- Signed-out, removed-member, wrong-family and former-reviewer reads; no source image in family response; no cache/CDN leak.

## Worker-compatible encoder shortlist

| Rank | Candidate | Fit and cost boundary | Open qualification |
| --- | --- | --- | --- |
| 1, conditional | Cloudflare Images byte-stream binding on Images Free | Accepts raw bytes without a public URL, outputs a chosen image format, supports info and animation controls. Official Free plan says 5,000 unique transformations/month, new transforms fail with9422 over limit and no charge. No additional npm codec needed. | Existing account plan/entitlement not checked. Paid plan has overages, so cannot assume a free allowance makes a paid account zero-risk. Need distinct binding name, explicit metadata:none support through binding, orientation/metadata fixtures and hard application quota. No upgrade or activation approved. |
| 2 | jSquash JPEG + PNG decode and WebP encode, optionally resize | Apache-2.0 package family with official Cloudflare Workers examples and explicit WASM initialization. No new external image processor or per-image service fee. Decode pixels and encode a new container rather than copying source metadata. | New packages require a proposal and pin/security/license review, not added here. Need actual bundle and workerd tests, header/pixel limits before allocation, free-plan CPU/memory budget, orientation and metadata fixture proof. Reject unsupported HEIC rather than claim support. |
| 3 | @cf-wasm/photon/workerd | Apache-2.0 package, explicit workerd import and JPEG/PNG/WebP output, Rust/WASM implementation. Supports explicit image.free cleanup. | New dependency proposal, version/license/transitive review, actual Worker CPU/memory tests, metadata/orientation evidence and safe allocations. Maintainer warns about128MB memory. Broader processing surface than needed, so second WASM choice. |

Not selected: ordinary Sharp/native libvips in the Worker. A local development dependency is not proof of workerd compatibility. Cloudflare's SDK issue records native-module runtime failure and recommends another route. No native addon, paid image SaaS, browser-only sanitizer or public transform endpoint is an approved substitute.

Workers Free currently documents10 ms CPU and128 MB isolate memory. WASM compatibility is therefore not proof that re-encoding phone photos fits the free plan. The current25million-pixel draft cap alone could allocate roughly100 MB just for one RGBA buffer before codec/intermediate overhead. Lower admission bounds must be chosen from measured memory/CPU budgets, not compression size. No benchmark/deployment was run in this research.

## Decision boundary

No Luis decision needed for this document or further private design review. Before adding packages, propose the smallest pinned codec set and expected bundle/runtime budget. Before enabling Images, verify the existing account is on a hard-stop free path and that an activation does not enable overages. If either fails, stop and bring the concrete alternative; do not ask for a paid plan as a default. All rollout, schema execution and feature enablement remain separate approvals.

## Sources checked November23,2026

1. Cloudflare Images pricing, official plan/cap behavior: https://developers.cloudflare.com/images/pricing/
2. Images binding, byte-stream input/output and setup: https://developers.cloudflare.com/images/optimization/binding/
3. Images features, metadata/orientation semantics: https://developers.cloudflare.com/images/optimization/features/
4. Workers limits, CPU and memory: https://developers.cloudflare.com/workers/platform/limits/
5. jSquash maintainer repository and Cloudflare examples: https://github.com/jamsinclair/jSquash/
6. JPEG package API/orientation/license: https://registry.npmjs.org/%40jsquash%2Fjpeg
7. PNG codec/license: https://registry.npmjs.org/%40jsquash%2Fpng
8. Photon workerd usage and memory warning: https://github.com/fineshopdesign/cf-wasm/blob/main/packages/photon/README.md
9. Photon package/license: https://www.npmjs.com/package/@cf-wasm/photon
10. Native Sharp incompatibility example, maintainer issue discussion, not a universal support contract: https://github.com/cloudflare/workers-sdk/issues/12338

Sources establish documented capability, not this account's plan, a benchmark, legal adequacy or deployment readiness. In particular, the Images feature reference documents metadata modes, while the binding output reference does not list a metadata option. That gap must be resolved before selecting the binding as a sanitizer.
