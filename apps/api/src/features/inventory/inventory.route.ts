import { Hono } from 'hono';
import { requireOrgPermission } from '../../infra/middleware/require-permission';
import { InventoryController } from './inventory.controller';
import { ReturnsController } from './returns.controller';

export const inventoryRouter = new Hono();

// Stock queries require the view_stock permission (Category 4 — computed financial data).
inventoryRouter.get('/stock', requireOrgPermission('inventory:view_stock'), InventoryController.getStock);
inventoryRouter.get('/transactions', requireOrgPermission('inventory:view_transactions'), InventoryController.getTransactions);
inventoryRouter.get('/eligible-returns', requireOrgPermission('inventory:view_transactions'), InventoryController.getEligibleReturns);
inventoryRouter.post('/transactions', requireOrgPermission('inventory:create_purchase'), InventoryController.createTransaction);

// Dedicated Sale & Purchase Return endpoints (8-step validation flow)
inventoryRouter.get('/returns/sale', requireOrgPermission('inventory:view_transactions'), ReturnsController.listSaleReturns);
inventoryRouter.get('/returns/purchase', requireOrgPermission('inventory:view_transactions'), ReturnsController.listPurchaseReturns);
inventoryRouter.get('/returns/sale/:id', requireOrgPermission('inventory:view_transactions'), ReturnsController.getSaleReturnById);
inventoryRouter.get('/returns/purchase/:id', requireOrgPermission('inventory:view_transactions'), ReturnsController.getPurchaseReturnById);
inventoryRouter.get('/returns/eligible-items', requireOrgPermission('inventory:view_transactions'), ReturnsController.getEligibleReturnItems);
inventoryRouter.post('/returns/sale', requireOrgPermission('inventory:create_purchase'), ReturnsController.createSaleReturn);
inventoryRouter.post('/returns/purchase', requireOrgPermission('inventory:create_purchase'), ReturnsController.createPurchaseReturn);
