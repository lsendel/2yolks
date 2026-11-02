// Better Auth factory - DEV-ONLY passkey ceremony qualification.
// Mounted only under /api/dev/auth/* behind ALLOW_DEMO_SEED; never in
// production routes. Secret comes from env (dev var); the literal fallback
// is explicitly for local spike use and must never ship.
import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as authSchema from '../auth-schema';
import type { createDb } from './db';

export interface AuthSpikeEnv {
  BETTER_AUTH_SECRET?: string;
}

export function createAuth(db: ReturnType<typeof createDb>, baseURL: string, env: AuthSpikeEnv) {
  const origin = new URL(baseURL).origin;
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET ?? 'dev-only-insecure-spike-secret',
    baseURL,
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    emailAndPassword: { enabled: true }, // dev-only account bootstrap for the ceremony
    plugins: [
      passkey({
        rpID: 'localhost',
        rpName: '2yolks dev spike',
        origin: [origin],
      }),
    ],
  });
}
