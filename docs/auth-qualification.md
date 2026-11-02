# Auth qualification (free-tier engineering target; account is Workers Paid)

NOTE: the connected Cloudflare account is on Workers Paid (confirmed via
dashboard, Nov 1 2026). The 10 ms free-CPU figure below is the engineering
target for the approved no-new-spend build, not the account's actual plan;
designing to it keeps the build portable and cost-free if the plan changes.

Constraint: approved build targets free-tier limits (no new spend). Better Auth's default password
hashing (scrypt N=16384 r=8 p=1) measures 48-69 ms wall in local workerd
(dev route /api/dev/cpu-spike, 3 runs, Nov 1 2026) vs the 10 ms Workers Free
CPU limit - password-hash auth as designed does NOT fit free CPU. Local wall
time is a risk indicator, not a precise production CPU measurement; the gap
(5-7x) is far beyond measurement noise. No password-hash auth is activated.

## Options qualified

### Passkeys (WebAuthn) - recommended primary
- Ceremony cost measured in local workerd (dev route /api/dev/passkey-spike,
  Nov 1 2026): ECDSA P-256 verify 0.08 ms avg over 25 iterations (2 ms total);
  keygen+sign 2 ms. WebCrypto executes natively and per Cloudflare docs is not
  billed against Workers CPU time, so a passkey ceremony fits the free 10 ms
  CPU budget with wide margin. No password hashing anywhere.
- Still NOT a full-flow verification: the spike measures the dominant crypto
  op, not an end-to-end WebAuthn registration/assertion with the Better Auth
  passkey plugin, which remains to be wired and measured before activation.
- No email delivery dependency for sign-in.
- Caveats: account bootstrap + cross-device recovery still need an email
  fallback; Better Auth has a passkey plugin (verify against current release
  at implementation time).

### Passwordless email code - recommended fallback / bootstrap
- Short-lived one-time codes, rate-limited and stored as SHA-256 digests
  (WebCrypto, microseconds) - no scrypt needed; 6-digit codes with expiry +
  attempt limits have no offline-attack surface that would require scrypt.
- Email delivery (verified Nov 1, 2026):
  - Resend Free: 3,000 emails/month, 100/day cap (resend.com/pricing).
  - Brevo Free: 300 transactional emails/day (help.brevo.com FAQ 208580669).
  - Cloudflare Email Sending: arbitrary recipients require Workers PAID
    (developers.cloudflare.com/email-service/platform/pricing, Jun 9 2026) -
    NOT a free path for login codes; only verified-account addresses are free.
- 100/day (Resend free) comfortably fits a private alpha; a public launch
  re-evaluates volume.

### Abuse protection
- Cloudflare Turnstile: free, already in the plan for submission forms; add
  to login-code request endpoint.

### Not viable on free tier
- Better Auth password flow (scrypt CPU, above).
- Cloudflare Email Sending for login codes (paid plan required).

## Spike evidence
- /api/dev/cpu-spike (ALLOW_DEMO_SEED gated, dev only): {"scrypt_ms":48-69,
  params N=16384 r=8 p=1 dkLen=32}.

## Better Auth passkey full-flow wiring - status (Nov 1, 2026)

RESOLVED (branch auth-passkey-spike, Nov 1, 2026): path (a) taken -
drizzle-orm upgraded to ^0.45.4, better-auth@1.7.15 + @better-auth/passkey
@1.7.15 installed cleanly, full suite green (tsc, 18 vitest, 27 smoke with
real D1 migrations/queries, 15 interaction), and a dev-only construction
spike (/api/dev/auth-spike, ALLOW_DEMO_SEED-gated) proves better-auth +
passkey plugin + drizzle adapter bundle and construct inside workerd. No
schema, no migration, no auth routes mounted; submissions stay 503-gated.
Original conflict record: better-auth@1.7.15 requires
drizzle-orm ^0.45.2 (or 1.0 rc); the repo had pinned drizzle-orm@0.38.4.
Considered paths:
- (a) Upgrade drizzle-orm to ^0.45.2 across the repo, re-run the full
  suite against the existing D1 layer, then use better-auth's drizzle
  adapter. Cleaner long-term; touches the reviewed data layer.
- (b) Keep drizzle 0.38 for app tables and use better-auth's kysely
  adapter with the Cloudflare D1 kysely dialect, installing with
  --legacy-peer-deps (better-auth then never touches drizzle at runtime).
  Lower blast radius; adds kysely as a second query layer.

Remaining steps for full-flow qualification: better-auth schema tables
(user/session/account/passkey), RP ID + origin pinned to the canonical
origin, a dev-only ceremony route that measures a real
registration+assertion verification end to end in workerd (software
authenticator fixture), and only then any activation decision. No auth
code is activated anywhere; POST /api/v1/submissions stays 503-gated.

## End-to-end passkey ceremony - QUALIFIED (dev-only, Nov 1, 2026)

Real WebAuthn ceremonies executed against local workerd with a Chrome CDP
virtual authenticator (scripts/auth-ceremony.check.mjs, rpID localhost,
origin pinned to the dev origin; production pinning would use the canonical
origin - no production route exists):
- email sign-up 200 (adapter writes user + session rows to D1; verified in
  sqlite: user/passkey tables hold the ceremony rows)
- passkey registration 200, server verify wall 22-23 ms
- passkey authentication 200, server verify wall 21 ms, session issued
Challenge round-trip (better-auth-passkey cookie) exercised by the
ceremonies themselves. Wall time is client-observed UX evidence, NOT
Workers CPU billing measurement; the dominant op is ECDSA P-256 verify via
WebCrypto, which Cloudflare documents as off-clock, and the microbenchmark
(0.08 ms/verify) is consistent with a comfortable free-CPU margin.

Adversarial regression probes (permanent, in the ceremony script):
- replay of a consumed assertion: 400 CHALLENGE_NOT_FOUND
- tampered challenge (different challenge signed): 400/401
  AUTHENTICATION_FAILED (reviewer observed 401; local reproduction 400 -
  same code, asserted as 400/401 + code)
- a failed verification CONSUMES the live challenge: a valid assertion
  against it afterwards is 400 CHALLENGE_NOT_FOUND
- verify without the options cookie: 400
- cookieless get-session: 200 null
- weak password sign-up: 400
- all dev routes 404 with ALLOW_DEMO_SEED unset (in smoke.mjs)

Bootstrap: scripts/auth-ceremony.check.mjs resets .wrangler, applies
migrations 0001+0002 to local D1, spawns and group-kills its own dev
server, and polls /api/health for readiness - no dependence on dirty
state, no leftover processes.

Production denial verified: with ALLOW_DEMO_SEED unset, /api/dev/auth/*,
/api/dev/auth-test, /api/dev/auth-spike all 404 (asserted in smoke.mjs).
Secret comes from BETTER_AUTH_SECRET env var; the literal fallback is
labeled dev-only and never ships.

NOT established (first-release gating): production CPU billing (needs a
deployed measurement), canonical rpID/origin over HTTPS, secret store
without the dev fallback, session/secure-cookie policy, whether any
password path fits CPU (passkey-first avoids it), Turnstile integration,
account-recovery flows, multi-device UX, remote 0002 migration. Local
passkey auth is QUALIFIED AS A DEV SPIKE ONLY - it is not a complete
product auth and is not activated anywhere.

## Production config draft (NOT activated, Nov 1, 2026)

Draft values for when activation is authorized; none of this is live:
- rpID: 2yolks.com (canonical origin host; https://2yolks.com as origin,
  single entry, no www variant until a redirect strategy exists)
- Session cookie: httpOnly, Secure, SameSite=Lax, __Host- prefix, 7-day
  expiry (better-auth defaults), no cross-subdomain scope
- Secret: BETTER_AUTH_SECRET from the vault at deploy time; the dev
  fallback literal must be removed or fail-closed when ALLOW_DEMO_SEED is
  unset (currently the dev routes are unreachable without the flag, so the
  fallback is unreachable in production - keep it that way)
- Base path: /api/auth/* (current dev mount /api/dev/auth/* is temporary)

## Passkey-only: enrollment and recovery design (draft decision, not launch-ready)

- Enrollment: user creates account, adds first passkey; adding MORE
  passkeys per account must be supported (better-auth list/delete exist)
  because a single-passkey account is a lost-device lockout.
- Recovery options considered:
  (a) recovery email link - requires qualified email sending (blocked:
      no email account grant, and CF Email Sending is paid-only);
  (b) one-time recovery codes shown at enrollment - no email dependency,
      user-managed; needs secure display + hashed storage;
  (c) multiple passkeys across devices - partial mitigation only.
- Draft recommendation: passkey-first with (b) recovery codes at
  enrollment + (a) when email qualifies. Password path stays OFF: hashing
  busts free CPU by measurement and adds no UX the launch needs.
- NOT launch-ready claims: this design is unreviewed; UX for
  enrollment/recovery is not built; CPU billing is unmeasured in
  production.
