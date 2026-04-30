import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { redis } from '../lib/redis'

export const rateLimit = (limit = 100, windowSecs = 60) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1'
    const key = `rate-limit:${ip}`

    try {
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, windowSecs)
      }

      c.header('X-RateLimit-Limit', limit.toString())
      c.header('X-RateLimit-Remaining', Math.max(0, limit - current).toString())

      if (current > limit) {
        return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded. Try again later.' }, 429)
      }
    } catch (error) {
      console.error('[RateLimiter] Redis error, bypassing limit:', error)
    }

    await next()
  })
}
