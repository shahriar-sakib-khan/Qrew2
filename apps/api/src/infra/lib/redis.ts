import Redis from 'ioredis'
import { logger } from './logger'

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set.')
}

/**
 * The single Redis client instance for the entire API.
 *
 * Module-level singletons are guaranteed in Node.js — once this
 * module is imported, Node caches it. Every subsequent import
 * gets the same instance. No globalThis trick needed here.
 *
 * Used for:
 * - Better Auth secondary storage (session caching)
 * - Rate limiting counters
 * - General key/value caching
 */
export const redis = new Redis(process.env.REDIS_URL, {
  // Fail fast if Redis is down — don't queue requests in memory.
  // Better Auth falls back to Postgres automatically when Redis
  // commands fail, so this is safe.
  enableOfflineQueue: false,

  // After 3 failed attempts, stop retrying and throw.
  // Prevents hanging requests when Redis is genuinely offline.
  maxRetriesPerRequest: 3,
})

const redisLog = logger.child({ module: 'redis' })

redis.on('connect', () => {
  redisLog.info('connected')
})

redis.on('error', (err) => {
  redisLog.error({ err: err.message }, 'error')
})

redis.on('reconnecting', () => {
  redisLog.warn('reconnecting...')
})
