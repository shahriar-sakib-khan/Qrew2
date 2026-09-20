/**
 * product-categories.test.ts
 *
 * Comprehensive unit/integration tests for ProductCategoriesController:
 *   - list: returns organization-scoped product categories
 *   - create: validation errors (name required), successful insertion (201)
 *   - update: 404 on missing, validation, successful update (200)
 *   - remove: 404 on missing, successful deletion (200)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCategoriesController } from "./product-categories.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  const mockDbQuery = {
    productCategories: {
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
  productCategories: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
    description: "description",
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

describe("ProductCategoriesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns all categories for organization", async () => {
      const mockCategories = [
        { id: "cat1", organizationId: "org_123", name: "Beverages", isActive: true },
        { id: "cat2", organizationId: "org_123", name: "Snacks", isActive: true },
      ];
      mockDbQuery.productCategories.findMany.mockResolvedValueOnce(mockCategories);

      const ctx = createMockContext();
      const res: any = await ProductCategoriesController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockCategories);
    });
  });

  describe("create", () => {
    it("returns 400 on invalid payload", async () => {
      const ctx = createMockContext({ body: { name: "" } });
      const res: any = await ProductCategoriesController.create(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toBe("Validation Error");
    });

    it("creates category and returns 201", async () => {
      const newCategory = {
        id: "cat-new",
        organizationId: "org_123",
        name: "Electronics",
        description: "Gadgets",
        isActive: true,
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newCategory]),
        }),
      });

      const ctx = createMockContext({
        body: { name: "Electronics", description: "Gadgets", isActive: true },
      });
      const res: any = await ProductCategoriesController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data).toEqual(newCategory);
    });
  });

  describe("update", () => {
    it("returns 404 when category does not exist", async () => {
      mockDbQuery.productCategories.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({
        params: { id: "non-existent" },
        body: { name: "Updated" },
      });
      const res: any = await ProductCategoriesController.update(ctx);

      expect(res.status).toBe(404);
      expect(res.data.error).toBe("Not Found");
    });

    it("updates category successfully and returns updated record", async () => {
      const existing = { id: "cat1", organizationId: "org_123", name: "Old" };
      const updated = { id: "cat1", organizationId: "org_123", name: "New", isActive: false };
      mockDbQuery.productCategories.findFirst.mockResolvedValueOnce(existing);

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updated]),
          }),
        }),
      });

      const ctx = createMockContext({
        params: { id: "cat1" },
        body: { name: "New", isActive: false },
      });
      const res: any = await ProductCategoriesController.update(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(updated);
    });
  });

  describe("remove", () => {
    it("returns 404 when category does not exist", async () => {
      mockDbQuery.productCategories.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "cat-none" } });
      const res: any = await ProductCategoriesController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("deletes category and returns success true", async () => {
      mockDbQuery.productCategories.findFirst.mockResolvedValueOnce({
        id: "cat1",
        organizationId: "org_123",
      });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "cat1" } });
      const res: any = await ProductCategoriesController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });
});
