# Community kitchen-test reports: moderation rules

The community-tested path lets a signed-in cook report that they cooked a
published recipe. A report is a queue row only. Nothing a cook submits ever
changes the site by itself; the `Tested` label appears only when a moderator
approves a report.

## What a cook can do

- Sign in (email code), open a published recipe, and send one report per
  recipe, with an optional 280-character note and a required checkbox:
  "I cooked this recipe in a kitchen."
- A cook cannot report their own submitted recipe. Its tested label comes
  from the original submission attestation (`recipes.attested_at`), not from
  the community path.
- Duplicates are refused: one report per cook per recipe, enforced in the
  INSERT and by a unique index.

## What a moderator does

Queue: MCP `recipes.list_test_reports` (default `status: pending`).
Decide: MCP `recipes.moderate_test_report` with `id` and `decision`.

**Approve** when the report is plausible: the note (when present) reads like a
real kitchen run, the account is not a throwaway, and there is no sign of
coordination (same note text across recipes, bursts from one account).
Approving stamps `recipes.tested_at` (the report's creation time) and
`recipes.tested_by` (the cook's display name, falling back to "A 2yolks
cook") - only while `tested_at` is still empty. The first approved report
wins; later approvals corroborate and never rewrite the stamp.

**Reject** when the report is spam, boilerplate, coordinated, or about a
recipe the cook plainly could not have cooked. Rejection hides the report
(`status: rejected`). Nothing is deleted: rejected and approved rows stay in
the table as the audit trail, with `moderated_at` and `moderated_by`.

## Hard rules

- Never approve without reading the report row itself
  (`recipes.list_test_reports`), including the note and the cook's account.
- Never set `tested_at`/`tested_by` by hand. The label exists only as the
  result of an approved report (or a first-party kitchen test recorded
  directly on the recipe).
- A recipe with no approved report keeps the "Not yet tested" label. That
  honesty is the product; the label is never marketing.
- Rate limits: report posts share the submission rate limiter
  (`RL_SUBMIT`). The review-notification email shares the daily notice budget
  with recipe submissions, so the Resend free plan cannot be overrun.
