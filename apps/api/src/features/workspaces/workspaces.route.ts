import { Hono } from 'hono';
import { WorkspacesController } from './workspaces.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const workspacesRouter = new Hono();

// POST /api/workspaces/staff
workspacesRouter.post(
  '/staff', 
  requireOrgPermission('staff:provision'), 
  WorkspacesController.addStaff
);
