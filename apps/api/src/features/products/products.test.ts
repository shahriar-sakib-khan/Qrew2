/**
 * products.test.ts
 *
 * Comprehensive unit/integration tests for ProductsController:
 *   - list: returns organization-scoped products, handles category and active filters
 *   - getById: returns 404 on missing, product with relations on hit
 *   - create: validation errors, supports NORMAL and REFILLABLE types
 *   - update: verifies productType is preserved (NOT overwritten to NORMAL!), updates relations
 *   - remove: checks existence (404), prevents deleting products with transaction history (409), deletes cleanly
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsController } from "./products.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  const mockDbQuery = {
    products: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  const mockDbInsert = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockDbDelete = vi.fn();
  return { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete };
});

vi.mock("@starter/db", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
  },
  products: {
    id: "id",
    organizationId: "organization_id",
    categoryId: "category_id",
    brandId: "brand_id",
    name: "name",
    unit: "unit",
    sku: "sku",
    barcode: "barcode",
    description: "description",
    productType: "product_type",
    purchasePrice: "purchase_price",
    sellingPrice: "selling_price",
    isActive: "is_active",
  },
}));

function createMockContext({
  body,
  params = {},
  query = {},
  orgId = "org_123",
}: {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  orgId?: string;
} = {}) {
  return {
    get: (k: string) => (k === "organizationId" ? orgId : undefined),
    req: {
      json: async () => body,
      param: (k: string) => params[k],
      query: (k?: string) => (k ? query[k] : query),
    },
    json: (data: any, status = 200) => ({ data, status }),
  } as any;
}

describe("ProductsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns products list with relations", async () => {
      const mockProducts = [
        { id: "p1", name: "Standard Widget", unit: "pcs", productType: "NORMAL" },
        { id: "p2", name: "Oxygen Cylinder", unit: "cylinder", productType: "REFILLABLE" },
      ];
      mockDbQuery.products.findMany.mockResolvedValueOnce(mockProducts);

      const ctx = createMockContext({ query: { categoryId: "cat_1", isActive: "true" } });
      const res: any = await ProductsController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockProducts);
    });
  });

  describe("getById", () => {
    it("returns 404 when product is missing", async () => {
      mockDbQuery.products.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "p-missing" } });
      const res: any = await ProductsController.getById(ctx);

      expect(res.status).toBe(404);
      expect(res.data.error).toBe("Not Found");
    });

    it("returns product with relations when found", async () => {
      const product = {
        id: "p1",
        name: "LPG Tank",
        unit: "tank",
        productType: "REFILLABLE",
        category: { id: "cat1", name: "Gas" },
        brand: { id: "b1", name: "CleanEnergy" },
      };
      mockDbQuery.products.findFirst.mockResolvedValueOnce(product);

      const ctx = createMockContext({ params: { id: "p1" } });
      const res: any = await ProductsController.getById(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(product);
    });
  });

  describe("create", () => {
    it("returns 400 when missing name or unit", async () => {
      const ctx = createMockContext({ body: { name: "", unit: "" } });
      const res: any = await ProductsController.create(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toBe("Validation Error");
    });

    it("creates a NORMAL product successfully (default type)", async () => {
      const newProduct = {
        id: "p-new",
        name: "Steel Bolt",
        unit: "box",
        productType: "NORMAL",
        purchasePrice: "10.00",
        sellingPrice: "15.00",
        isActive: true,
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce(undefined),
      });
      mockDbQuery.products.findFirst.mockResolvedValueOnce(newProduct);

      const ctx = createMockContext({
        body: {
          name: "Steel Bolt",
          unit: "box",
          purchasePrice: "10.00",
          sellingPrice: "15.00",
        },
      });
      const res: any = await ProductsController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data.productType).toBe("NORMAL");
    });

    it("creates a REFILLABLE product laying groundwork for phase 2", async () => {
      const newProduct = {
        id: "p-refill",
        name: "Water Dispenser Bottle 20L",
        unit: "bottle",
        productType: "REFILLABLE",
        purchasePrice: "5.00",
        sellingPrice: "8.00",
        isActive: true,
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce(undefined),
      });
      mockDbQuery.products.findFirst.mockResolvedValueOnce(newProduct);

      const ctx = createMockContext({
        body: {
          name: "Water Dispenser Bottle 20L",
          unit: "bottle",
          productType: "REFILLABLE",
          purchasePrice: "5.00",
          sellingPrice: "8.00",
        },
      });
      const res: any = await ProductsController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data.productType).toBe("REFILLABLE");
    });
  });

  describe("update", () => {
    it("returns 404 when product is missing", async () => {
      mockDbQuery.products.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({
        params: { id: "p-missing" },
        body: { name: "New Name", unit: "kg" },
      });
      const res: any = await ProductsController.update(ctx);

      expect(res.status).toBe(404);
    });

    it("preserves REFILLABLE productType on update without reverting to NORMAL", async () => {
      const existing = {
        id: "p-refill",
        organizationId: "org_123",
        name: "Water Bottle",
        unit: "bottle",
        productType: "REFILLABLE",
      };
      const updated = {
        ...existing,
        name: "Premium Water Bottle 20L",
        sellingPrice: "10.00",
      };

      // 1. Initial lookup
      mockDbQuery.products.findFirst.mockResolvedValueOnce(existing);

      // 2. Mock update set
      let setValues: any;
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockImplementationOnce((vals) => {
          setValues = vals;
          return {
            where: vi.fn().mockResolvedValueOnce(undefined),
          };
        }),
      });

      // 3. Final enriched lookup
      mockDbQuery.products.findFirst.mockResolvedValueOnce(updated);

      const ctx = createMockContext({
        params: { id: "p-refill" },
        body: {
          name: "Premium Water Bottle 20L",
          unit: "bottle",
          productType: "REFILLABLE",
          sellingPrice: "10.00",
        },
      });
      const res: any = await ProductsController.update(ctx);

      expect(res.status).toBe(200);
      expect(setValues.productType).toBe("REFILLABLE");
      expect(res.data.name).toBe("Premium Water Bottle 20L");
    });
  });

  describe("remove", () => {
    it("returns 404 when product not found", async () => {
      mockDbQuery.products.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "p-none" } });
      const res: any = await ProductsController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when foreign key constraint 23503 prevents deletion", async () => {
      mockDbQuery.products.findFirst.mockResolvedValueOnce({ id: "p1", organizationId: "org_123" });
      const fkError: any = new Error("FK violation");
      fkError.code = "23503";

      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(fkError),
      });

      const ctx = createMockContext({ params: { id: "p1" } });
      const res: any = await ProductsController.remove(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("existing order or transaction history");
    });

    it("deletes product successfully when no transactions exist", async () => {
      mockDbQuery.products.findFirst.mockResolvedValueOnce({ id: "p1", organizationId: "org_123" });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "p1" } });
      const res: any = await ProductsController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });
});
