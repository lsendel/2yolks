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

Dependency conflict found at install time: better-auth@1.7.15 requires
drizzle-orm ^0.45.2 (or 1.0 rc); the repo pins drizzle-orm@0.38.4. Not yet
resolved. Candidate paths:
- (a) Upgrade drizzle-orm to ^0.45.2 across the repo, re-run the full
  suite against the existing D1 layer, then use better-auth's drizzle
  adapter. Cleaner long-term; touches the reviewed data layer.
- (b) Keep drizzle 0.38 for app tables and use better-auth's kysely
  adapter with the Cloudflare D1 kysely dialect, installing with
  --legacy-peer-deps (better-auth then never touches drizzle at runtime).
  Lower blast radius; adds kysely as a second query layer.

Remaining steps after the adapter decision: better-auth schema tables
(user/session/account/passkey), RP ID + origin pinned to the canonical
origin, a dev-only ceremony route that measures a real
registration+assertion verification end to end in workerd (software
authenticator fixture), and only then any activation decision. No auth
code is activated anywhere; POST /api/v1/submissions stays 503-gated.
