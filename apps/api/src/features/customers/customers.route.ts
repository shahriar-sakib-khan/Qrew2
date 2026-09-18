import { Hono } from 'hono';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { CustomersController } from './customers.controller';

export const customersRouter = new Hono();

customersRouter.get('/', requireOrgPermission('inventory:view_customers'), CustomersController.list);
customersRouter.post('/', requireOrgPermission('inventory:create_customer'), CustomersController.create);
customersRouter.put('/:id', requireOrgPermission('inventory:edit_customer'), CustomersController.update);
customersRouter.delete('/:id', requireOrgPermission('inventory:delete_customer'), CustomersController.remove);
