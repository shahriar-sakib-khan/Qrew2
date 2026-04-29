import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------
// Enums
// ---------------------------------------------------------------

/**
 * System-level role for every user account.
 * Enforced at the Postgres level — the DB rejects any other value.
 *
 * - user        → standard account, access to user dashboard only
 * - admin       → access to admin panel, can manage users
 * - super_admin → full system access, can manage admins
 */
export const systemRoleEnum = pgEnum('system_role', [
  'user',
  'admin',
  'super_admin',
])

// ---------------------------------------------------------------
// Users
// ---------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),

  // System role — typed enum, never a free-text string
  systemRole: systemRoleEnum('system_role').notNull().default('user'),

  // Two-factor auth flag — Better Auth 2FA plugin reads this column
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),

  // Soft ban — bannedAt being non-null means the account is banned
  bannedAt: timestamp('banned_at', { mode: 'date' }),
  bannedReason: text('banned_reason'),

  // Soft delete — deletedAt being non-null means the account is deleted
  deletedAt: timestamp('deleted_at', { mode: 'date' }),

  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------

/**
 * Database-backed sessions managed by Better Auth.
 * Redis will mirror active sessions for fast lookup —
 * this table remains the source of truth.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// ---------------------------------------------------------------
// Accounts (OAuth + credential links)
// ---------------------------------------------------------------

/**
 * One row per auth method per user.
 * A user who signs in with Google AND email/password has two rows here.
 * providerId = 'credential' for email/password accounts.
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// ---------------------------------------------------------------
// Verifications (magic link + email verification tokens)
// ---------------------------------------------------------------

/**
 * Short-lived tokens for email verification and magic links.
 * Better Auth writes and consumes these automatically.
 * Rows are safe to purge after expiresAt — add a cron or pg_cron job later.
 */
export const verifications = pgTable('verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// ---------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------

/**
 * Use these types everywhere in the codebase instead of
 * manually writing out the shape. They stay in sync with
 * the schema automatically — no duplication.
 */
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert

export type SystemRole = (typeof systemRoleEnum.enumValues)[number]
