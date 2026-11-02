// CLI-only entry for better-auth schema generation.
import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
  secret: 'cli-schema-gen',
  // dummy db: schema generation only reads the adapter's provider/schema
  database: drizzleAdapter({} as never, { provider: 'sqlite' }),
  plugins: [passkey()],
});
