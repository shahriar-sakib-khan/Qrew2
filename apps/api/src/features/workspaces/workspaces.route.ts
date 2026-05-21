import { Hono } from 'hono';
import { WorkspacesController } from './workspaces.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { PermissionsController } from '../permissions/permissions.controller';

export const workspacesRouter = new Hono();

// GET /api/workspaces/permissions/me
workspacesRouter.get('/permissions/me', PermissionsController.getMyPermissions);

// POST /api/workspaces/staff
workspacesRouter.post(
  '/staff', 
  requireOrgPermission('staff:provision'), 
  WorkspacesController.addStaff
);
