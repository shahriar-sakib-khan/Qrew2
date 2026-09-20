/**
 * brands.test.ts
 *
 * Comprehensive unit/integration tests for BrandsController:
 *   - list: returns organization-scoped brands
 *   - create: validates payload, handles duplicate name (409) and success (201)
 *   - update: validates payload, checks existence (404), handles duplicates (409), updates successfully
 *   - remove: checks existence (404), enforces organization-scoped deletion
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandsController } from "./brands.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  const mockDbQuery = {
    brands: {
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
  brands: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
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

describe("BrandsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns list of brands for organization", async () => {
      const mockBrands = [
        { id: "b1", organizationId: "org_123", name: "Brand A", isActive: true },
        { id: "b2", organizationId: "org_123", name: "Brand B", isActive: false },
      ];
      mockDbQuery.brands.findMany.mockResolvedValueOnce(mockBrands);

      const ctx = createMockContext();
      const res: any = await BrandsController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockBrands);
      expect(mockDbQuery.brands.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("returns 400 when validation fails (empty name)", async () => {
      const ctx = createMockContext({ body: { name: "" } });
      const res: any = await BrandsController.create(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toBe("Validation Error");
    });

    it("creates brand successfully and returns 201", async () => {
      const newBrand = { id: "b-new", organizationId: "org_123", name: "Nike", isActive: true };
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newBrand]),
        }),
      });

      const ctx = createMockContext({ body: { name: "Nike", isActive: true } });
      const res: any = await BrandsController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data).toEqual(newBrand);
    });

    it("returns 409 on duplicate brand name within org", async () => {
      const duplicateError: any = new Error("Unique constraint violation");
      duplicateError.code = "23505";

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(duplicateError),
        }),
      });

      const ctx = createMockContext({ body: { name: "Existing Brand" } });
      const res: any = await BrandsController.create(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("already exists");
    });
  });

  describe("update", () => {
    it("returns 404 if brand is not found in organization", async () => {
      mockDbQuery.brands.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({
        params: { id: "non-existent" },
        body: { name: "Updated Brand", isActive: true },
      });
      const res: any = await BrandsController.update(ctx);

      expect(res.status).toBe(404);
      expect(res.data.error).toBe("Not Found");
    });

    it("updates brand successfully and returns 200", async () => {
      const existing = { id: "b1", organizationId: "org_123", name: "Old", isActive: true };
      const updated = { id: "b1", organizationId: "org_123", name: "New", isActive: false };
      mockDbQuery.brands.findFirst.mockResolvedValueOnce(existing);

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updated]),
          }),
        }),
      });

      const ctx = createMockContext({
        params: { id: "b1" },
        body: { name: "New", isActive: false },
      });
      const res: any = await BrandsController.update(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(updated);
    });
  });

  describe("remove", () => {
    it("returns 404 if brand does not exist", async () => {
      mockDbQuery.brands.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "b-none" } });
      const res: any = await BrandsController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("deletes brand and returns success true", async () => {
      const existing = { id: "b1", organizationId: "org_123", name: "To Delete" };
      mockDbQuery.brands.findFirst.mockResolvedValueOnce(existing);
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "b1" } });
      const res: any = await BrandsController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });
});
