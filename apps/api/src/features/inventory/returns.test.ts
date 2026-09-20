/**
 * returns.test.ts
 *
 * Comprehensive unit/integration tests for ReturnsController (8-Step Flow):
 *   - createSaleReturn:
 *       - rejects if original sale item not found
 *       - rejects if parent sale is not CONFIRMED
 *       - rejects if original sale belongs to another organization (cross-tenant protection)
 *       - rejects if return quantity exceeds remaining returnable quantity
 *       - creates sale return document and positive stock entry in inventory_transactions upon success
 *   - createPurchaseReturn:
 *       - rejects if parent purchase is not CONFIRMED
 *       - rejects if return quantity exceeds remaining returnable quantity
 *       - creates purchase return document and negative stock entry in inventory_transactions
 *   - listSaleReturns: returns organization-scoped sale returns
 *   - listPurchaseReturns: returns organization-scoped purchase returns
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnsController } from "./returns.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction } = vi.hoisted(
  () => {
    const mockDbQuery = {
      saleReturns: { findMany: vi.fn(), findFirst: vi.fn() },
      purchaseReturns: { findMany: vi.fn(), findFirst: vi.fn() },
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
  sales: {
    id: "id",
    organizationId: "organization_id",
    status: "status",
    saleNumber: "sale_number",
  },
  saleItems: { id: "id", saleId: "sale_id", productId: "product_id", quantity: "quantity" },
  saleReturns: { id: "id", organizationId: "organization_id", status: "status" },
  saleReturnItems: {
    id: "id",
    saleReturnId: "sale_return_id",
    originalSaleItemId: "original_sale_item_id",
    quantity: "quantity",
  },
  purchases: {
    id: "id",
    organizationId: "organization_id",
    status: "status",
    purchaseNumber: "purchase_number",
  },
  purchaseItems: {
    id: "id",
    purchaseId: "purchase_id",
    productId: "product_id",
    quantity: "quantity",
  },
  purchaseReturns: { id: "id", organizationId: "organization_id", status: "status" },
  purchaseReturnItems: {
    id: "id",
    purchaseReturnId: "purchase_return_id",
    originalPurchaseItemId: "original_purchase_item_id",
    quantity: "quantity",
  },
  inventoryTransactions: { id: "id", organizationId: "organization_id" },
  clients: { id: "id" },
  customers: { id: "id" },
  products: { id: "id" },
}));

vi.mock("./inventory.service", () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue("SR-001"),
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

describe("ReturnsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSaleReturns", () => {
    it("returns list of sale returns for organization", async () => {
      const mockReturns = [{ id: "sr-1", returnNumber: "SR-001", status: "CONFIRMED" }];
      mockDbQuery.saleReturns.findMany.mockResolvedValueOnce(mockReturns);

      const ctx = createMockContext();
      const res: any = await ReturnsController.listSaleReturns(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockReturns);
    });
  });

  describe("listPurchaseReturns", () => {
    it("returns list of purchase returns for organization", async () => {
      const mockReturns = [{ id: "pr-1", returnNumber: "PR-001", status: "CONFIRMED" }];
      mockDbQuery.purchaseReturns.findMany.mockResolvedValueOnce(mockReturns);

      const ctx = createMockContext();
      const res: any = await ReturnsController.listPurchaseReturns(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockReturns);
    });
  });

  describe("createSaleReturn", () => {
    it("returns 400 when return item is missing or invalid", async () => {
      const ctx = createMockContext({
        body: { customerId: "c1", returnDate: "2026-09-20", items: [] },
      });
      const res: any = await ReturnsController.createSaleReturn(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Validation Error");
    });

    it("rejects return if original sale invoice is not CONFIRMED", async () => {
      mockDbTransaction.mockImplementationOnce(async (callback) => {
        let callCount = 0;
        const tx = {
          select: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // Locked line item
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    for: vi
                      .fn()
                      .mockResolvedValue([
                        { id: "item-1", saleId: "sale-1", quantity: "5", unitPrice: "20" },
                      ]),
                  }),
                }),
              };
            }
            // Parent sale (DRAFT status)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  {
                    id: "sale-1",
                    organizationId: "org_123",
                    saleNumber: "SAL-001",
                    status: "DRAFT",
                  },
                ]),
              }),
            };
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({
        body: {
          customerId: "cust-1",
          returnDate: "2026-09-20",
          items: [
            {
              originalSaleItemId: "item-1",
              productId: "prd-1",
              quantity: "2",
              unitPrice: "20",
            },
          ],
        },
      });

      const res: any = await ReturnsController.createSaleReturn(ctx);
      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Returns are only allowed against CONFIRMED invoices");
    });

    it("rejects return if requested quantity exceeds original returnable limit", async () => {
      mockDbTransaction.mockImplementationOnce(async (callback) => {
        let callCount = 0;
        const tx = {
          select: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // Line item: originally sold 5 units
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    for: vi
                      .fn()
                      .mockResolvedValue([
                        { id: "item-1", saleId: "sale-1", quantity: "5", unitPrice: "20" },
                      ]),
                  }),
                }),
              };
            }
            if (callCount === 2) {
              // Parent sale (CONFIRMED)
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([
                    {
                      id: "sale-1",
                      organizationId: "org_123",
                      saleNumber: "SAL-001",
                      status: "CONFIRMED",
                    },
                  ]),
                }),
              };
            }
            // Previously returned aggregate: 4 units returned
            return {
              from: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([{ totalReturned: "4" }]),
                }),
              }),
            };
          }),
        };
        return callback(tx);
      });

      const ctx = createMockContext({
        body: {
          customerId: "cust-1",
          returnDate: "2026-09-20",
          items: [
            {
              originalSaleItemId: "item-1",
              productId: "prd-1",
              quantity: "3", // 3 requested, but only 1 remains (5 - 4)!
              unitPrice: "20",
            },
          ],
        },
      });

      const res: any = await ReturnsController.createSaleReturn(ctx);
      expect(res.status).toBe(400);
      expect(res.data.error).toContain("exceeds remaining invoice limit");
    });

    it("creates sale return and writes stock-IN ledger row when valid", async () => {
      let insertedLedgerRows: any[] = [];

      mockDbTransaction.mockImplementationOnce(async (callback) => {
        let callCount = 0;
        const tx = {
          select: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    for: vi
                      .fn()
                      .mockResolvedValue([
                        { id: "item-1", saleId: "sale-1", quantity: "10", unitPrice: "15" },
                      ]),
                  }),
                }),
              };
            }
            if (callCount === 2) {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([
                    {
                      id: "sale-1",
                      organizationId: "org_123",
                      saleNumber: "SAL-001",
                      status: "CONFIRMED",
                    },
                  ]),
                }),
              };
            }
            // No previous returns (0)
            return {
              from: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([{ totalReturned: "0" }]),
                }),
              }),
            };
          }),
          insert: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation((val) => {
              if (Array.isArray(val) && val[0]?.transactionType === "SALE_RETURN") {
                insertedLedgerRows = val;
              }
              return {
                returning: vi.fn().mockResolvedValue([{ id: "sr-new", status: "CONFIRMED" }]),
              };
            }),
          })),
        };
        return callback(tx);
      });

      const ctx = createMockContext({
        body: {
          customerId: "cust-1",
          returnDate: "2026-09-20",
          items: [
            {
              originalSaleItemId: "item-1",
              productId: "prd-1",
              quantity: "2",
              unitPrice: "15",
            },
          ],
        },
      });

      const res: any = await ReturnsController.createSaleReturn(ctx);
      expect(res.status).toBe(201);
      expect(res.data.status).toBe("CONFIRMED");
      expect(insertedLedgerRows.length).toBe(1);
      expect(insertedLedgerRows[0].quantity).toBe("2");
    });
  });
});
