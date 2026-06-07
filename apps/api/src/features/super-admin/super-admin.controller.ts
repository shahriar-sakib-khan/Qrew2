import { Context } from 'hono';
import { db, users, auditLogs, sessions } from '@starter/db';
import { desc, eq, ne, count } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../../infra/lib/logger';
import { auth } from '../../infra/lib/auth';

const superAdminControllerLog = logger.child({ module: 'super-admin-controller' });

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const elevateRoleSchema = z.object({
  targetUserId: z.string().min(1),
  newRole: z.enum(['admin', 'super_admin']),
  reason: z.string().min(10, 'SOC2 Audit reason required'),
});

export class SuperAdminController {
  static async listAuditLogs(c: Context) {
    try {
      const queryParams = c.req.query();
      const parsed = paginationSchema.safeParse(queryParams);
      
      if (!parsed.success) {
        return c.json({ error: 'Invalid pagination parameters', details: parsed.error.format() }, 400);
      }

      const { page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const [dataResult, countResult] = await Promise.all([
        db.select({
          id: auditLogs.id,
          action: auditLogs.action,
          reason: auditLogs.reason,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt,
          adminId: auditLogs.adminId,
          targetUserId: auditLogs.targetUserId,
          // We can't do direct nested relation queries in raw select easily without joins.
          // We'll use table joins to get names/emails.
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
        db.select({ total: count() }).from(auditLogs)
      ]);

      // Enhance data with user info
      // Instead of complex joins, we can query users separately or use Drizzle relational API
      const enrichedData = await Promise.all(dataResult.map(async (log) => {
        const [admin, target] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, log.adminId), columns: { email: true, name: true } }),
          db.query.users.findFirst({ where: eq(users.id, log.targetUserId), columns: { email: true, name: true } })
        ]);
        return {
          ...log,
          adminEmail: admin?.email || 'Unknown',
          targetEmail: target?.email || 'Unknown',
        };
      }));

      const totalRecords = countResult[0]?.total || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      return c.json({
        data: enrichedData,
        meta: {
          total: totalRecords,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        }
      }, 200);

    } catch (error) {
      superAdminControllerLog.error({ err: error }, 'Failed to list audit logs');
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async elevateRole(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = elevateRoleSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: 'Bad Request', issues: parsed.error.format() }, 400);
      }

      const { targetUserId, newRole, reason } = parsed.data;
      const adminUser = c.get('user') as any;

      if (!adminUser) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        columns: { role: true },
      });

      if (!targetUser) {
        return c.json({ error: 'Not Found', message: 'Target user does not exist.' }, 404);
      }

      if (targetUser.role === newRole) {
        return c.json({ error: 'Conflict', message: `User is already ${newRole}.` }, 409);
      }

      await db.update(users)
        .set({ role: newRole })
        .where(eq(users.id, targetUserId));

      const auditPromise = db.insert(auditLogs).values({
        adminId: adminUser.id,
        targetUserId: targetUserId,
        action: `ELEVATE_ROLE_${newRole.toUpperCase()}`,
        reason: reason,
        ipAddress: c.req.header('x-forwarded-for') || 'unknown',
      }).catch(err => c.get('logger').error({ err }, 'Failed to write elevation audit log'));

      try {
        c.executionCtx.waitUntil(auditPromise);
      } catch (e) {
        Promise.resolve(auditPromise);
      }

      return c.json({ success: true, message: `User ${targetUserId} elevated to ${newRole}` }, 200);

    } catch (error) {
      superAdminControllerLog.error({ err: error }, 'Role elevation failed');
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async nukeSessions(c: Context) {
    try {
      const adminUser = c.get('user') as any;

      if (!adminUser) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Delete all sessions EXCEPT the one belonging to the current super admin
      // Using 'ne' (not equal)
      await db.delete(sessions).where(ne(sessions.userId, adminUser.id));

      const auditPromise = db.insert(auditLogs).values({
        adminId: adminUser.id,
        targetUserId: adminUser.id, // Using self as target for a global action
        action: 'GLOBAL_SESSION_NUKE',
        reason: 'Emergency session invalidation triggered by super admin',
        ipAddress: c.req.header('x-forwarded-for') || 'unknown',
      }).catch(err => c.get('logger').error({ err }, 'Failed to write nuke audit log'));

      try {
        c.executionCtx.waitUntil(auditPromise);
      } catch (e) {
        Promise.resolve(auditPromise);
      }

      return c.json({ success: true, message: 'All active sessions globally nuked.' }, 200);

    } catch (error) {
      superAdminControllerLog.error({ err: error }, 'Session nuke failed');
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
