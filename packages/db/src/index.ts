import * as schema from './schema'

// ---------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.')
}

const DATABASE_URL = process.env.DATABASE_URL
const isProd = process.env.NODE_ENV === 'production'

// ---------------------------------------------------------------
// Environment-aware database client
// ---------------------------------------------------------------

/**
 * In development  → postgres.js driver (local Docker Postgres)
 * In production   → @neondatabase/serverless driver (Neon cloud)
 *
 * Both drivers accept the same DATABASE_URL format.
 * Only the underlying transport layer changes.
 */

import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'

function createDb() {
  if (isProd) {
    /**
     * Neon serverless driver.
     * Uses Neon's HTTP transport — optimised for serverless and edge
     * runtimes where persistent TCP connections are not available.
     * CONNECTION: Neon cloud database (production).
     */
    const { neon } = require('@neondatabase/serverless')
    const sql = neon(DATABASE_URL)
    return drizzleNeon(sql, { schema })
  }

  /**
   * postgres.js driver.
   * Uses a persistent TCP connection pool — faster for long-running
   * server processes like your local Hono dev server.
   * CONNECTION: local Docker Postgres (development).
   */
  const postgres = require('postgres')
  const client = postgres(DATABASE_URL)
  return drizzlePostgres(client, { schema })
}

/**
 * The single Drizzle db client for the entire application.
 * Import this wherever you need to run queries:
 *
 *   import { db } from '@starter/db'
 *   const result = await db.select().from(users)
 */
export const db = createDb()

// ---------------------------------------------------------------
// Schema re-exports
// ---------------------------------------------------------------

/**
 * All tables and TypeScript types available from one import:
 *
 *   import { db, users, User, SystemRole } from '@starter/db'
 */
export * from './schema'
