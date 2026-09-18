/**
 * brands.route.ts
 * Inventory brands router — PBAC gated.
 * Reading brands requires inventory:view_products (needed to populate dropdowns).
 * Writing brands requires inventory:manage_brands.
 */

import { Hono } from 'hono';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { BrandsController } from './brands.controller';

export const brandsRouter = new Hono();

brandsRouter.get('/', requireOrgPermission('inventory:view_products'), BrandsController.list);
brandsRouter.post('/', requireOrgPermission('inventory:manage_brands'), BrandsController.create);
brandsRouter.put('/:id', requireOrgPermission('inventory:manage_brands'), BrandsController.update);
brandsRouter.delete('/:id', requireOrgPermission('inventory:manage_brands'), BrandsController.remove);
