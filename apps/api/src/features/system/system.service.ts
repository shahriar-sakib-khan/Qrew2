import { db } from '@starter/db'
import { sql } from 'drizzle-orm'
import { redis } from '../../infra/lib/redis'

export const SystemService = {
  async getSystemHealth() {
    const [dbStatus, redisStatus] = await Promise.all([
      db.execute(sql`SELECT 1`).then(() => 'connected').catch(() => 'disconnected'),
      redis.ping().then(() => 'connected').catch(() => 'disconnected')
    ])

    return {
      status: (dbStatus === 'connected' && redisStatus === 'connected') ? 'ok' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString()
    }
  }
}
