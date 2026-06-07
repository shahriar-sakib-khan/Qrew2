import { Hono } from 'hono';
import { WorkspacesController } from './workspaces.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { PermissionsController } from '../permissions/permissions.controller';
import { RolesController } from '../roles/roles.controller';
export const workspacesRouter = new Hono();

import { customFieldsRouter } from '../custom-fields/custom-fields.route';
import { clientsRouter } from '../clients/clients.route';
import { projectsRouter } from '../projects/projects.route';

workspacesRouter.route('/custom-fields', customFieldsRouter);
workspacesRouter.route('/clients', clientsRouter);
workspacesRouter.route('/projects', projectsRouter);

// GET /api/workspaces/dashboard-stats
workspacesRouter.get('/dashboard-stats', WorkspacesController.getDashboardStats);

// GET /api/workspaces/permissions/me
workspacesRouter.get('/permissions/me', PermissionsController.getMyPermissions);

// GET/PATCH /api/workspaces/settings
workspacesRouter.get('/settings', WorkspacesController.getSettings);
workspacesRouter.patch('/settings', requireOrgPermission('org:manage'), WorkspacesController.updateSettings);

// POST /api/workspaces/staff/invite
workspacesRouter.post(
  '/staff/invite', 
  requireOrgPermission('staff:provision'), 
  WorkspacesController.inviteStaff
);
workspacesRouter.get('/staff/invites', requireOrgPermission('staff:provision'), WorkspacesController.listInvitations);
workspacesRouter.get('/staff/invites/:id', WorkspacesController.getInvitation);
workspacesRouter.delete('/staff/invites/:id', requireOrgPermission('staff:provision'), WorkspacesController.cancelInvitation);
workspacesRouter.post('/staff/invites/accept', WorkspacesController.acceptInvitation);

workspacesRouter.get('/staff/list', WorkspacesController.listStaff);
workspacesRouter.put('/staff/:memberId/role', requireOrgPermission('role:manage'), WorkspacesController.updateStaffRole);
workspacesRouter.delete('/staff/:memberId', requireOrgPermission('staff:revoke'), WorkspacesController.revokeStaff);

// --- Roles & Permissions ---

// Permission Registry (read-only, no special permission needed)
workspacesRouter.get('/roles/registry', RolesController.getPermissionRegistry);

// Role CRUD (list/get are open to authenticated users, mutations require role:manage)
workspacesRouter.get('/roles', RolesController.listRoles);
workspacesRouter.post('/roles', requireOrgPermission('role:manage'), RolesController.createRole);
workspacesRouter.get('/roles/:roleId', RolesController.getRole);
workspacesRouter.put('/roles/:roleId', requireOrgPermission('role:manage'), RolesController.updateRole);
workspacesRouter.delete('/roles/:roleId', requireOrgPermission('role:manage'), RolesController.deleteRole);
