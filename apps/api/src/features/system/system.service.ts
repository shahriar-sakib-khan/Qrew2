import { db } from '@starter/db'
import { sql } from 'drizzle-orm'

export const SystemService = {
  async getSystemHealth() {
    const dbStatus = await db.execute(sql`SELECT 1`).then(() => 'connected').catch(() => 'disconnected')

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString()
    }
  }
}
