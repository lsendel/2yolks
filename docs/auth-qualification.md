# Auth qualification (Workers Free, paid OFF)

Constraint: approved build is free-tier only. Better Auth's default password
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
