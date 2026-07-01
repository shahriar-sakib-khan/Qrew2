import { Hono } from 'hono';
import { SuperAdminController } from './super-admin.controller';
import { requireAuth } from '../../infra/middleware/auth';
import { requireRole } from '../../infra/middleware/role';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const superAdminRouter = new Hono();

// All routes require super_admin role
superAdminRouter.use('/*', requireAuth, requireRole('super_admin'));

superAdminRouter.get('/audit-logs', SuperAdminController.listAuditLogs);
superAdminRouter.get('/permissions', SuperAdminController.listPermissions);

superAdminRouter.post('/elevate-role',
  zValidator('json', z.object({
    targetUserId: z.string().min(1),
    newRole: z.enum(['admin', 'super_admin']),
    reason: z.string().min(10)
  })),
  SuperAdminController.elevateRole
);

superAdminRouter.post('/nuke-sessions', SuperAdminController.nukeSessions);

export { superAdminRouter };
