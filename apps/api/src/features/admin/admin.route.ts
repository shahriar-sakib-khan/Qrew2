import { Hono } from 'hono';
import { AdminController } from './admin.controller';
import { SecurityController } from './security.controller';
import { requireAuth } from '../../infra/middleware/auth';
import { requireRole } from '../../infra/middleware/role';

export const adminRouter = new Hono();

// Allow stop-impersonation for currently impersonated users (who might currently have 'user' role)
adminRouter.post('/stop-impersonation', requireAuth, AdminController.stopImpersonation);

// Apply auth session parsing first, then enforce minimum role level
adminRouter.use('/*', requireAuth, requireRole('admin'));

adminRouter.get('/users', AdminController.listUsers);
adminRouter.get('/workspaces', AdminController.listWorkspaces);
adminRouter.post('/impersonate', AdminController.impersonateUser);
adminRouter.post('/security-action', SecurityController.enforceSecurityAction);

