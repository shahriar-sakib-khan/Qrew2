import { Hono } from 'hono';
import { CustomFieldsController } from './custom-fields.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const customFieldsRouter = new Hono();

// We might want to use a specific permission like 'schema:manage_fields' later,
// but for now, any generic admin/workspace permission could work. We'll use schema:manage_fields 
// based on what's in seed.ts.

customFieldsRouter.get('/', CustomFieldsController.listDefinitions); // Everyone in org can read to render forms
customFieldsRouter.post('/', requireOrgPermission('schema:manage_fields'), CustomFieldsController.createDefinition);
customFieldsRouter.put('/:id', requireOrgPermission('schema:manage_fields'), CustomFieldsController.updateDefinition);
customFieldsRouter.delete('/:id', requireOrgPermission('schema:manage_fields'), CustomFieldsController.deleteDefinition);
