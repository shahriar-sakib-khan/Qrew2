/**
 * Central schema export.
 *
 * Every schema file in this folder is re-exported from here.
 * - drizzle-kit reads this to discover all tables for migrations
 * - Application code imports tables and types from '@starter/db'
 *   which resolves through src/index.ts → src/schema/index.ts
 *
 * When adding a new schema file (e.g. org.ts in Phase 2),
 * add a single line here: export * from './org'
 */
export * from './auth'
export * from './pbac'
export * from './clients'
export * from './projects'
export * from './custom_fields'
