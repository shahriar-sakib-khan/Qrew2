/**
 * sales.test.ts
 *
 * Comprehensive unit/integration tests for SalesController:
 *   - list: returns organization-scoped sales
 *   - getById: returns 404 on missing, returns sale document with customer and items on hit
 *   - create: generates sequential document number (SAL-001) in transaction, inserts items
 *   - remove: prevents deleting CONFIRMED sales (409), deletes DRAFT sales cleanly
 *   - confirm:
 *       - locks product rows for concurrency safety
 *       - checks stock: rejects with 409 if requested quantity exceeds current stock
 *       - writes negative quantity stock-OUT ledger rows when stock is sufficient
 *       - updates status to CONFIRMED
 *   - cancel: checks CONFIRMED status, writes positive-signed reversal rows, updates status to CANCELLED
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesController } from "./sales.controller";

const {
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbTransaction,
  mockDbSelect,
  mockDbExecute,
} = vi.hoisted(() => {
  const mockDbQuery = {
    sales: {
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
  const mockDbSelect = vi.fn();
  const mockDbExecute = vi.fn();
  return {
    mockDbQuery,
    mockDbInsert,
    mockDbUpdate,
    mockDbDelete,
    mockDbTransaction,
    mockDbSelect,
    mockDbExecute,
  };
});

vi.mock("@starter/db", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
    select: (...args: any[]) => mockDbSelect(...args),
    execute: (...args: any[]) => mockDbExecute(...args),
    transaction: (fn: any) => mockDbTransaction(fn),
  },
  sales: {
    id: "id",
    organizationId: "organization_id",
    customerId: "customer_id",
    warehouseId: "warehouse_id",
    saleNumber: "sale_number",
    saleDate: "sale_date",
    status: "status",
    totalAmount: "total_amount",
  },
  saleItems: {
    id: "id",
    saleId: "sale_id",
    productId: "product_id",
    quantity: "quantity",
  },
  products: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
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
  generateDocumentNumber: vi.fn().mockResolvedValue("SAL-001"),
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

describe("SalesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns list of sales for the organization", async () => {
      const mockSales = [
        { id: "sal-1", saleNumber: "SAL-001", status: "DRAFT", totalAmount: "250.00" },
      ];
      mockDbQuery.sales.findMany.mockResolvedValueOnce(mockSales);

      const ctx = createMockContext();
      const res: any = await SalesController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockSales);
    });
  });

  describe("getById", () => {
    it("returns 404 when sale does not exist", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "sal-none" } });
      const res: any = await SalesController.getById(ctx);

      expect(res.status).toBe(404);
      expect(res.data.error).toBe("Not Found");
    });

    it("returns sale details with relations when found", async () => {
      const mockSale = {
        id: "sal-1",
        saleNumber: "SAL-001",
        status: "CONFIRMED",
        items: [{ id: "si-1", productId: "prd-1", quantity: "2" }],
      };
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(mockSale);

      const ctx = createMockContext({ params: { id: "sal-1" } });
      const res: any = await SalesController.getById(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockSale);
    });
  });

  describe("create", () => {
    it("creates draft sale in transaction and returns 201", async () => {
      const createdSale = {
        id: "sal-new",
        organizationId: "org_123",
        saleNumber: "SAL-001",
        status: "DRAFT",
        totalAmount: "200.00",
      };

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([createdSale]),
            }),
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({
        body: {
          customerId: "cust-1",
          warehouseId: "wh-1",
          saleDate: "2026-09-20",
          items: [
            {
              productId: "prd-1",
              stockState: "NORMAL",
              quantity: "4",
              unitPrice: "50.00",
              total: "200.00",
            },
          ],
          totalAmount: "200.00",
        },
      });

      const res: any = await SalesController.create(ctx);
      expect(res.status).toBe(201);
      expect(res.data).toEqual(createdSale);
    });
  });

  describe("remove", () => {
    it("returns 404 when sale does not exist", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "sal-none" } });
      const res: any = await SalesController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when attempting to delete a CONFIRMED sale", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce({
        id: "sal-conf",
        organizationId: "org_123",
        status: "CONFIRMED",
      });

      const ctx = createMockContext({ params: { id: "sal-conf" } });
      const res: any = await SalesController.remove(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Only DRAFT sales can be deleted");
    });

    it("deletes a DRAFT sale cleanly", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce({
        id: "sal-draft",
        organizationId: "org_123",
        status: "DRAFT",
      });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "sal-draft" } });
      const res: any = await SalesController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });

  describe("confirm", () => {
    it("returns 404 when sale does not exist", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "sal-none" } });
      const res: any = await SalesController.confirm(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when sale is already confirmed", async () => {
      mockDbQuery.sales.findFirst.mockResolvedValueOnce({
        id: "sal-1",
        status: "CONFIRMED",
        items: [{ id: "i1" }],
      });

      const ctx = createMockContext({ params: { id: "sal-1" } });
      const res: any = await SalesController.confirm(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Cannot confirm");
    });

    it("returns 409 when current stock is insufficient", async () => {
      const mockSale = {
        id: "sal-draft",
        saleNumber: "SAL-001",
        status: "DRAFT",
        items: [
          {
            productId: "prd-1",
            stockState: "NORMAL",
            quantity: "10", // Requests 10 units
          },
        ],
      };
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(mockSale);

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        let selectCallCount = 0;
        const tx = {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // Call 1: Locking query with .for("update")
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([{ id: "prd-1", name: "Gadget" }]),
                  }),
                }),
              };
            }
            // Call 2: getCurrentStock query (awaited directly after .where)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: "5" }]), // Only 5 in stock (insufficient)
              }),
            };
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({ params: { id: "sal-draft" } });
      const res: any = await SalesController.confirm(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Insufficient stock");
    });

    it("confirms sale and writes negative stock-OUT rows when stock is sufficient", async () => {
      const mockSale = {
        id: "sal-draft",
        saleNumber: "SAL-001",
        status: "DRAFT",
        warehouseId: "wh-1",
        items: [
          {
            productId: "prd-1",
            stockState: "NORMAL",
            quantity: "3", // Requests 3 units
          },
        ],
      };
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(mockSale);

      let insertedLedgerRows: any[] = [];
      let updatedStatus: any;

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        let selectCallCount = 0;
        const tx = {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // Call 1: Locking query
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([{ id: "prd-1", name: "Gadget" }]),
                  }),
                }),
              };
            }
            // Call 2: getCurrentStock query (sufficient stock)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: "20" }]), // 20 in stock
              }),
            };
          }),
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

      const ctx = createMockContext({ params: { id: "sal-draft" } });
      const res: any = await SalesController.confirm(ctx);

      expect(res.status).toBe(200);
      expect(insertedLedgerRows.length).toBe(1);
      expect(insertedLedgerRows[0].quantity).toBe("-3.000"); // Negative stock OUT
      expect(insertedLedgerRows[0].transactionType).toBe("SALE");
      expect(updatedStatus).toBe("CONFIRMED");
    });
  });

  describe("cancel", () => {
    it("cancels confirmed sale and inserts positive reversal rows into ledger", async () => {
      const mockSale = {
        id: "sal-conf",
        saleNumber: "SAL-001",
        status: "CONFIRMED",
      };
      mockDbQuery.sales.findFirst.mockResolvedValueOnce(mockSale);

      mockDbQuery.inventoryTransactions.findMany.mockResolvedValueOnce([
        {
          id: "tx-sale-1",
          warehouseId: "wh-1",
          productId: "prd-1",
          stockState: "NORMAL",
          quantity: "-3.000",
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

      const ctx = createMockContext({ params: { id: "sal-conf" } });
      const res: any = await SalesController.cancel(ctx);

      expect(res.status).toBe(200);
      expect(reversalRows.length).toBe(1);
      expect(reversalRows[0].quantity).toBe("3.000"); // Opposite sign reversal restores stock!
      expect(reversalRows[0].transactionType).toBe("SALE_RETURN");
      expect(updatedStatus).toBe("CANCELLED");
    });
  });
});
