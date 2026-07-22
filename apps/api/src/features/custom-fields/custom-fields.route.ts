import { Hono } from 'hono';
import { CustomFieldsController } from './custom-fields.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const customFieldsRouter = new Hono();

// Everyone authenticated in the org can read field definitions
// (private fields are filtered server-side based on role)
customFieldsRouter.get('/', CustomFieldsController.listDefinitions);

// Only users with workspace:manage_fields can create/update/delete field definitions
customFieldsRouter.post('/', requireOrgPermission('workspace:manage_fields'), CustomFieldsController.createDefinition);
customFieldsRouter.put('/:id', requireOrgPermission('workspace:manage_fields'), CustomFieldsController.updateDefinition);
customFieldsRouter.delete('/:id', requireOrgPermission('workspace:manage_fields'), CustomFieldsController.deleteDefinition);
