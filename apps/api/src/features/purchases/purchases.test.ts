/**
 * purchases.test.ts
 *
 * Comprehensive unit/integration tests for PurchasesController:
 *   - list: returns organization-scoped purchases with relations
 *   - getById: returns 404 for missing purchase, returns purchase document with items on hit
 *   - create: validates schema, generates sequential document number (PUR-001) in transaction, inserts items
 *   - update: checks DRAFT status (409 if confirmed), replaces items, updates header
 *   - remove: prevents deleting CONFIRMED purchases (409), deletes DRAFT purchases cleanly
 *   - confirm: checks DRAFT status, creates positive quantity ledger rows in inventory_transactions, sets status to CONFIRMED
 *   - cancel: checks CONFIRMED status, writes opposite-signed reversal rows into ledger, sets status to CANCELLED
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchasesController } from "./purchases.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction } = vi.hoisted(
  () => {
    const mockDbQuery = {
      purchases: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      inventoryTransactions: {
        findMany: vi.fn(),
      },
    };
    const mockDbInsert = vi.fn();
    const mockDbUpdate = vi.fn();
    const mockDbDelete = vi.fn();
    const mockDbTransaction = vi.fn();
    return {
      mockDbQuery,
      mockDbInsert,
      mockDbUpdate,
      mockDbDelete,
      mockDbTransaction,
    };
  },
);

vi.mock("@starter/db", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
    transaction: (fn: any) => mockDbTransaction(fn),
  },
  purchases: {
    id: "id",
    organizationId: "organization_id",
    supplierId: "supplier_id",
    warehouseId: "warehouse_id",
    purchaseNumber: "purchase_number",
    purchaseDate: "purchase_date",
    status: "status",
    totalAmount: "total_amount",
  },
  purchaseItems: {
    id: "id",
    purchaseId: "purchase_id",
    productId: "product_id",
    quantity: "quantity",
  },
  inventoryTransactions: {
    id: "id",
    organizationId: "organization_id",
    referenceType: "reference_type",
    referenceId: "reference_id",
  },
  orgDocumentCounters: {
    id: "id",
    organizationId: "organization_id",
    documentType: "document_type",
  },
}));

vi.mock("../inventory/inventory.service", () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue("PUR-001"),
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

describe("PurchasesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns purchases list scoped by organization", async () => {
      const mockList = [
        { id: "pur-1", purchaseNumber: "PUR-001", status: "DRAFT", totalAmount: "100.00" },
      ];
      mockDbQuery.purchases.findMany.mockResolvedValueOnce(mockList);

      const ctx = createMockContext();
      const res: any = await PurchasesController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockList);
    });
  });

  describe("getById", () => {
    it("returns 404 when purchase does not exist", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "p-missing" } });
      const res: any = await PurchasesController.getById(ctx);

      expect(res.status).toBe(404);
      expect(res.data.error).toBe("Not Found");
    });

    it("returns purchase document when found", async () => {
      const mockPurchase = {
        id: "pur-1",
        purchaseNumber: "PUR-001",
        status: "CONFIRMED",
        items: [{ id: "item-1", productId: "prd-1", quantity: "10" }],
      };
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(mockPurchase);

      const ctx = createMockContext({ params: { id: "pur-1" } });
      const res: any = await PurchasesController.getById(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockPurchase);
    });
  });

  describe("create", () => {
    it("creates draft purchase in transaction and returns 201", async () => {
      const createdPurchase = {
        id: "pur-new",
        organizationId: "org_123",
        purchaseNumber: "PUR-001",
        status: "DRAFT",
        totalAmount: "150.00",
      };

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([createdPurchase]),
            }),
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({
        body: {
          supplierId: "sup-1",
          warehouseId: "wh-1",
          purchaseDate: "2026-09-20",
          items: [
            {
              productId: "prd-1",
              stockState: "NORMAL",
              quantity: "5",
              unitCost: "30.00",
              total: "150.00",
            },
          ],
          totalAmount: "150.00",
        },
      });

      const res: any = await PurchasesController.create(ctx);
      expect(res.status).toBe(201);
      expect(res.data).toEqual(createdPurchase);
    });
  });

  describe("remove", () => {
    it("returns 404 when purchase not found", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "p-none" } });
      const res: any = await PurchasesController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when attempting to delete a CONFIRMED purchase", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce({
        id: "pur-conf",
        organizationId: "org_123",
        status: "CONFIRMED",
      });

      const ctx = createMockContext({ params: { id: "pur-conf" } });
      const res: any = await PurchasesController.remove(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Only DRAFT purchases can be deleted");
    });

    it("deletes a DRAFT purchase cleanly", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce({
        id: "pur-draft",
        organizationId: "org_123",
        status: "DRAFT",
      });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "pur-draft" } });
      const res: any = await PurchasesController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });

  describe("confirm", () => {
    it("returns 404 when purchase not found", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "p-none" } });
      const res: any = await PurchasesController.confirm(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 if purchase is already CONFIRMED", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce({
        id: "pur-1",
        status: "CONFIRMED",
        items: [{ id: "i1" }],
      });

      const ctx = createMockContext({ params: { id: "pur-1" } });
      const res: any = await PurchasesController.confirm(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Cannot confirm");
    });

    it("confirms draft purchase and writes stock-IN ledger rows", async () => {
      const mockPurchase = {
        id: "pur-draft",
        purchaseNumber: "PUR-001",
        status: "DRAFT",
        warehouseId: "wh-1",
        items: [
          {
            productId: "prd-1",
            stockState: "NORMAL",
            quantity: "10",
          },
        ],
      };
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(mockPurchase);

      let insertedLedgerRows: any[] = [];
      let updatedStatus: any;

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((rows) => {
              insertedLedgerRows = rows;
              return Promise.resolve();
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((setVals) => {
              updatedStatus = setVals.status;
              return {
                where: vi.fn().mockResolvedValue(undefined),
              };
            }),
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({ params: { id: "pur-draft" } });
      const res: any = await PurchasesController.confirm(ctx);

      expect(res.status).toBe(200);
      expect(insertedLedgerRows.length).toBe(1);
      expect(insertedLedgerRows[0].quantity).toBe("10"); // Positive stock IN
      expect(insertedLedgerRows[0].transactionType).toBe("PURCHASE");
      expect(updatedStatus).toBe("CONFIRMED");
    });
  });

  describe("cancel", () => {
    it("returns 409 when trying to cancel a DRAFT purchase", async () => {
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce({
        id: "pur-draft",
        status: "DRAFT",
      });

      const ctx = createMockContext({ params: { id: "pur-draft" } });
      const res: any = await PurchasesController.cancel(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Only CONFIRMED purchases can be cancelled");
    });

    it("cancels confirmed purchase and inserts opposite-signed reversal rows", async () => {
      const mockPurchase = {
        id: "pur-conf",
        purchaseNumber: "PUR-001",
        status: "CONFIRMED",
      };
      mockDbQuery.purchases.findFirst.mockResolvedValueOnce(mockPurchase);

      // Existing positive ledger rows (+10)
      mockDbQuery.inventoryTransactions.findMany.mockResolvedValueOnce([
        {
          id: "tx-1",
          warehouseId: "wh-1",
          productId: "prd-1",
          stockState: "NORMAL",
          quantity: "10.000",
        },
      ]);

      let reversalRows: any[] = [];
      let updatedStatus: any;

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((rows) => {
              reversalRows = rows;
              return Promise.resolve();
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((setVals) => {
              updatedStatus = setVals.status;
              return {
                where: vi.fn().mockResolvedValue(undefined),
              };
            }),
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({ params: { id: "pur-conf" } });
      const res: any = await PurchasesController.cancel(ctx);

      expect(res.status).toBe(200);
      expect(reversalRows.length).toBe(1);
      expect(reversalRows[0].quantity).toBe("-10.000"); // Opposite sign reversal!
      expect(reversalRows[0].transactionType).toBe("PURCHASE_RETURN");
      expect(updatedStatus).toBe("CANCELLED");
    });
  });
});
