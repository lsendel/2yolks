# Passkey account recovery - DESIGN DRAFT for review (Nov 1, 2026)

Status: DESIGN ONLY. No implementation started; implementation waits for
this design's independent review. Scope is bounded to passkey-account
recovery for the first build.

## Problem

A passkey-only account with one passkey is a lost-device lockout. Recovery
must work without email sending (not yet qualified: no account grant; CF
Email Sending is paid-tier; Resend/Brevo would be new accounts).

## Threat model

Assets: the user account (saved recipes, submissions), the passkey set.
Adversaries and abuse cases:
1. Attacker who finds/steals a printed or screenshotted recovery code.
2. Online guessing of recovery codes (rate-limit and entropy are the
   controls; codes must never be enumerable or short).
3. Database read of stored recovery codes (hashing is the control; codes
   are bearer secrets, never stored in clear).
4. Session hijack riding on a successful redeem (redeem must revoke
   existing sessions; the new session must be fresh).
5. User error: redeeming the last recovery code unknowingly (must show
   remaining-count after enrollment and after each redeem).
6. Phishing: recovery entry must happen only on the canonical origin;
   nothing in the design sends codes anywhere.

Out of scope for this design: device theft with an unlocked session
(OS-level concern), coercion, server compromise beyond read.

## Design

- Codes: 10 codes, each 10 Crockford-base32 characters (50 bits entropy)
  in grouped display form (XXXXX-XXXXX). Generated at enrollment;
  displayed ONCE with an explicit "save these now" interstitial.
- Storage: per-code SHA-256 hash (unsalted is acceptable at 50-bit entropy
  with single-use + rate limiting; salt adds little for random codes but
  is cheap - use HMAC with the server secret to make offline brute force
  depend on the secret). One active set per account; regeneration
  invalidates the previous set.
- Single use: redeeming a code deletes its hash immediately, in the same
  transaction as session creation.
- Redeem flow: enter email + one code -> verify hash -> create fresh
  session -> REVOKE all other sessions for the account -> require adding
  a new passkey immediately after redeem (the recovered session starts in
  a must-enroll state).
- Rate limiting: per-account and per-IP attempt limits (e.g. 5 failures
  per 10 min per account, 20 per IP per hour), failing closed with
  generic errors (no "email exists" oracle: redeem always answers
  identically whether or not the email exists).
- Revocation semantics: redeem invalidates existing sessions; passkeys
  are NOT removed automatically (the legitimate device keeps working;
  user can remove lost-device passkeys from the account page).
- Expiry: codes do not expire; count diminishes with use. When fewer
  than 3 remain, the account page prompts to regenerate.
- Audit: recovery events (issue/redeem/regenerate, never the code)
  logged with timestamp + IP for the account page's activity view.

## Open questions for review

1. HMAC-with-server-secret vs plain SHA-256 for code hashing.
2. Exact rate-limit numbers and lockout vs backoff.
3. Whether redeem may start WITHOUT email (passkey-only identifier)?
   Current design requires email as the lookup key - acceptable?
4. Remaining-count visibility: exact number vs threshold warnings only.

## Non-goals (first build)

- No email-based recovery (blocked on email qualification).
- No SMS/TOTP fallback (new dependencies, SIM-swap risk).
- No support-mediated recovery (no support channel exists).
