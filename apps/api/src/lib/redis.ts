import { Redis } from 'ioredis';

// ---------------------------------------------------------------
// Environment Guard
// ---------------------------------------------------------------
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set. Check your .env file.');
}

// ---------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// We limit retries so that if Redis is genuinely offline,
// the server fails fast rather than hanging incoming requests forever.
export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// ---------------------------------------------------------------
// Connection Logging
// ---------------------------------------------------------------
redis.on('connect', () => {
  console.log('🟢 [Redis] Connected successfully');
});

redis.on('error', (err) => {
  console.error('🔴 [Redis] Connection error:', err.message);
});
