// Better Auth factory for the passkey qualification spike.
// Construction only - no routes mounted, no schema applied.
import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { createDb } from './db';

export function createAuth(db: ReturnType<typeof createDb>) {
  return betterAuth({
    secret: 'dev-spike-not-a-real-secret',
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    plugins: [passkey()],
  });
}
