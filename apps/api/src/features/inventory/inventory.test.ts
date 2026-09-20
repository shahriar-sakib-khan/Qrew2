/**
 * inventory.test.ts
 *
 * Comprehensive unit/integration tests for InventoryController:
 *   - getStock: executes live SUM aggregation query from append-only ledger
 *   - getTransactions: returns audit log of stock movements with enriched party info
 *   - createTransaction:
 *       - handles single manual adjustment transactions
 *       - handles batch transaction items
 *       - validates schema and returns 400 on invalid input
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryController } from "./inventory.controller";

const { mockDbQuery, mockDbInsert, mockDbExecute, mockDbSelect } = vi.hoisted(() => {
  const mockDbQuery = {
    inventoryTransactions: {
      findMany: vi.fn(),
    },
    purchases: { findMany: vi.fn() },
    sales: { findMany: vi.fn() },
    saleReturns: { findMany: vi.fn() },
    purchaseReturns: { findMany: vi.fn() },
    clients: { findMany: vi.fn() },
    customers: { findMany: vi.fn() },
  };
  const mockDbInsert = vi.fn();
  const mockDbExecute = vi.fn();
  const mockDbSelect = vi.fn();
  return {
    mockDbQuery,
    mockDbInsert,
    mockDbExecute,
    mockDbSelect,
  };
});

vi.mock("@starter/db", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: any[]) => mockDbInsert(...args),
    execute: (...args: any[]) => mockDbExecute(...args),
    select: (...args: any[]) => mockDbSelect(...args),
  },
  inventoryTransactions: {
    id: "id",
    organizationId: "organization_id",
    warehouseId: "warehouse_id",
    productId: "product_id",
    stockState: "stock_state",
    quantity: "quantity",
    transactionType: "transaction_type",
    referenceType: "reference_type",
    referenceId: "reference_id",
    createdAt: "created_at",
  },
  products: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
  },
}));

function createMockContext({
  body,
  params = {},
  query = {},
  orgId = "org_123",
  user = { id: "usr_admin", role: "admin" },
}: {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  orgId?: string;
  user?: any;
} = {}) {
  return {
    get: (k: string) => {
      if (k === "organizationId") return orgId;
      if (k === "user") return user;
      return undefined;
    },
    req: {
      json: async () => body,
      param: (k: string) => params[k],
      query: (k?: string) => (k ? query[k] : query),
    },
    json: (data: any, status = 200) => ({ data, status }),
  } as any;
}

describe("InventoryController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStock", () => {
    it("returns computed live stock aggregated by product and stockState", async () => {
      const mockStockRows = [
        { product_id: "prd-1", stock_state: "NORMAL", current_stock: "15" },
        { product_id: "prd-2", stock_state: "FULL", current_stock: "25" },
        { product_id: "prd-2", stock_state: "EMPTY", current_stock: "10" },
      ];
      mockDbExecute.mockResolvedValueOnce(mockStockRows);

      const ctx = createMockContext();
      const res: any = await InventoryController.getStock(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockStockRows);
      expect(mockDbExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTransactions", () => {
    it("returns audit ledger rows with pagination and enriched metadata", async () => {
      const mockTxs = [
        {
          id: "tx-1",
          organizationId: "org_123",
          productId: "prd-1",
          transactionType: "PURCHASE",
          quantity: "10.000",
          referenceType: "PURCHASE",
          referenceId: "pur-1",
          createdAt: new Date(),
          product: { id: "prd-1", name: "Valve" },
          warehouse: { id: "wh-1", name: "Main WH" },
          createdByUser: { id: "u-1", name: "Admin" },
        },
      ];
      mockDbQuery.inventoryTransactions.findMany.mockResolvedValueOnce(mockTxs);
      mockDbQuery.purchases.findMany.mockResolvedValueOnce([]);
      mockDbQuery.sales.findMany.mockResolvedValueOnce([]);
      mockDbQuery.saleReturns.findMany.mockResolvedValueOnce([]);
      mockDbQuery.purchaseReturns.findMany.mockResolvedValueOnce([]);
      mockDbQuery.clients.findMany.mockResolvedValueOnce([]);
      mockDbQuery.customers.findMany.mockResolvedValueOnce([]);

      const ctx = createMockContext({ query: { page: "1", limit: "50" } });
      const res: any = await InventoryController.getTransactions(ctx);

      expect(res.status).toBe(200);
      expect(res.data.data.length).toBe(1);
      expect(res.data.data[0].id).toBe("tx-1");
    });
  });

  describe("createTransaction", () => {
    it("returns 400 when missing required product or quantity", async () => {
      const ctx = createMockContext({ body: { productId: "", quantity: 0 } });
      const res: any = await InventoryController.createTransaction(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Validation Error");
    });

    it("records a single manual stock adjustment (ADJUSTMENT_IN)", async () => {
      const newTx = {
        id: "tx-new",
        organizationId: "org_123",
        productId: "prd-1",
        quantity: "5",
        transactionType: "ADJUSTMENT_IN",
        referenceType: "MANUAL_ADJUSTMENT",
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newTx]),
        }),
      });

      const ctx = createMockContext({
        body: {
          productId: "prd-1",
          stockState: "NORMAL",
          quantity: "5",
          transactionType: "ADJUSTMENT_IN",
          referenceType: "MANUAL_ADJUSTMENT",
          notes: "Initial inventory count correction",
        },
      });

      const res: any = await InventoryController.createTransaction(ctx);
      expect(res.status).toBe(201);
      expect(res.data).toEqual(newTx);
    });

    it("records batch stock transactions successfully", async () => {
      const insertedRows = [
        { id: "tx-b1", productId: "prd-1", quantity: "10" },
        { id: "tx-b2", productId: "prd-2", quantity: "-2" },
      ];

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce(insertedRows),
        }),
      });

      const ctx = createMockContext({
        body: {
          items: [
            {
              productId: "prd-1",
              stockState: "NORMAL",
              quantity: "10",
              transactionType: "ADJUSTMENT_IN",
              referenceType: "MANUAL_ADJUSTMENT",
            },
            {
              productId: "prd-2",
              stockState: "NORMAL",
              quantity: "-2",
              transactionType: "ADJUSTMENT_OUT",
              referenceType: "MANUAL_ADJUSTMENT",
            },
          ],
        },
      });

      const res: any = await InventoryController.createTransaction(ctx);
      expect(res.status).toBe(201);
      expect(res.data.count).toBe(2);
    });
  });
});
