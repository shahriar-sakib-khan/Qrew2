import { Hono } from 'hono';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { ProductCategoriesController } from './product-categories.controller';

export const productCategoriesRouter = new Hono();

// Viewing categories requires the base product view permission.
productCategoriesRouter.get('/', requireOrgPermission('inventory:view_products'), ProductCategoriesController.list);
productCategoriesRouter.post('/', requireOrgPermission('inventory:manage_categories'), ProductCategoriesController.create);
productCategoriesRouter.put('/:id', requireOrgPermission('inventory:manage_categories'), ProductCategoriesController.update);
productCategoriesRouter.delete('/:id', requireOrgPermission('inventory:manage_categories'), ProductCategoriesController.remove);
