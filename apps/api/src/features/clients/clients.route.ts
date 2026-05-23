import { Hono } from 'hono';
import { ClientsController } from './clients.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const clientsRouter = new Hono();

clientsRouter.get('/', requireOrgPermission('client:view'), ClientsController.listClients);
clientsRouter.post('/', requireOrgPermission('client:create'), ClientsController.createClient);
clientsRouter.put('/:id', requireOrgPermission('client:edit'), ClientsController.updateClient);
clientsRouter.delete('/:id', requireOrgPermission('client:delete'), ClientsController.deleteClient);
