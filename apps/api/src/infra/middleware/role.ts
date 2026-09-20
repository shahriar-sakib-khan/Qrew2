import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { AuthVariables } from './auth'

/**
 * System role hierarchy.
 * A higher number means more access.
 * super_admin can do everything admin can, and admin
 * can do everything user can.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  admin: 2,
  super_admin: 3,
}

/**
 * requireRole(minimumRole)
 *
 * Factory function — call it with the minimum role required
 * and it returns a Hono middleware that enforces that requirement.
 *
 * IMPORTANT: Always use AFTER requireAuth. This middleware
 * reads the user from context — requireAuth must have set it first.
 *
 * Usage:
 *   // Only admins and super admins can access this
 *   app.get('/admin/users', requireAuth, requireRole('admin'), handler)
 *
 *   // Only super admins can access this
 *   app.delete('/system/reset', requireAuth, requireRole('super_admin'), handler)
 *
 *   // Any authenticated user can access this (just use requireAuth alone)
 *   app.get('/dashboard', requireAuth, handler)
 */
export const requireRole = (minimumRole: keyof typeof ROLE_HIERARCHY) => {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (c: Context, next: Next) => {
      const user = c.get('user')

      // This should never happen if requireAuth ran first,
      // but guard anyway for safety.
      if (!user) {
        return c.json(
          { error: 'Unauthorized', message: 'Valid session required.' },
          401
        )
      }

      const userRole = (user as any).role as string ?? 'user'
      const userLevel = ROLE_HIERARCHY[userRole] ?? 0
      const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0

      if (userLevel < requiredLevel) {
        return c.json(
          {
            error: 'Forbidden',
            message: `Requires ${minimumRole} role or higher.`,
          },
          403
        )
      }

      await next()
    }
  )
}
