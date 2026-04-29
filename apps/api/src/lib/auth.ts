import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink, admin } from 'better-auth/plugins';
import { db } from '@starter/db';
import { redis } from './redis';

// Ensure the secret is present before starting the auth engine
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not set. Check your apps/api/.env file.');
}

export const auth = betterAuth({
  // 1. Database Connection (Using your single source of truth)
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  // 2. Core Security settings
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  // 3. Redis Secondary Storage (For lightning-fast session caching and rate limits)
  secondaryStorage: {
    get: async (key) => {
      const value = await redis.get(key);
      return value ? value : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        // 'EX' sets the expiration time in seconds
        await redis.set(key, value, 'EX', ttl);
      } else {
        await redis.set(key, value);
      }
    },
    delete: async (key) => {
      await redis.del(key);
    },
  },

  // 4. Authentication Methods
  emailAndPassword: {
    enabled: true,
  },

  // 5. Rate Limiting (Protects endpoints using the Redis storage defined above)
  rateLimit: {
    storage: 'secondary-storage',
    window: 60, // 1 minute window
    max: 100, // Max 100 requests per IP per window
  },

  // 6. Plugins
  plugins: [
    admin(), // Enables system-level role management
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        // We will wire up Resend or an SMTP service here later.
        // For local development, this logs the link to your terminal.
        console.log(`\n🔗 [Magic Link Generated]`);
        console.log(`To: ${email}`);
        console.log(`URL: ${url}\n`);
      },
      expiresIn: 60 * 15, // Link expires in 15 minutes
    }),
  ],
});
