import { Hono } from 'hono';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { WarehousesController } from './warehouses.controller';

export const warehousesRouter = new Hono();

// Viewing warehouses requires the stock view permission.
warehousesRouter.get('/', requireOrgPermission('inventory:view_stock'), WarehousesController.list);
warehousesRouter.post('/', requireOrgPermission('inventory:manage_warehouses'), WarehousesController.create);
warehousesRouter.put('/:id', requireOrgPermission('inventory:manage_warehouses'), WarehousesController.update);
warehousesRouter.delete('/:id', requireOrgPermission('inventory:manage_warehouses'), WarehousesController.remove);
