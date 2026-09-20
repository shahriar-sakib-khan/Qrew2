/**
 * warehouses.test.ts
 *
 * Comprehensive unit/integration tests for WarehousesController:
 *   - list: returns organization-scoped warehouses
 *   - create: validates name and code, creates warehouse (201)
 *   - update: checks existence (404), updates warehouse details (200)
 *   - remove: checks existence (404), catches transaction history FK violation 23503 (409), deletes cleanly
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WarehousesController } from "./warehouses.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  const mockDbQuery = {
    warehouses: {
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
  warehouses: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
    code: "code",
    address: "address",
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

describe("WarehousesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns list of warehouses for organization", async () => {
      const mockWarehouses = [
        { id: "w1", organizationId: "org_123", name: "Main Hub", code: "WH-1" },
        { id: "w2", organizationId: "org_123", name: "Depot B", code: "WH-2" },
      ];
      mockDbQuery.warehouses.findMany.mockResolvedValueOnce(mockWarehouses);

      const ctx = createMockContext();
      const res: any = await WarehousesController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockWarehouses);
    });
  });

  describe("create", () => {
    it("returns 400 when missing name or code", async () => {
      const ctx = createMockContext({ body: { name: "", code: "" } });
      const res: any = await WarehousesController.create(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toBe("Validation Error");
    });

    it("creates warehouse and returns 201", async () => {
      const newWarehouse = {
        id: "w-new",
        organizationId: "org_123",
        name: "North Branch",
        code: "NB-01",
        address: "742 Evergreen Terr",
        isActive: true,
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newWarehouse]),
        }),
      });

      const ctx = createMockContext({
        body: {
          name: "North Branch",
          code: "NB-01",
          address: "742 Evergreen Terr",
          isActive: true,
        },
      });
      const res: any = await WarehousesController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data.name).toBe("North Branch");
    });
  });

  describe("update", () => {
    it("returns 404 when warehouse does not exist", async () => {
      mockDbQuery.warehouses.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({
        params: { id: "w-missing" },
        body: { name: "Updated", code: "UP-1" },
      });
      const res: any = await WarehousesController.update(ctx);

      expect(res.status).toBe(404);
    });

    it("updates warehouse successfully and returns 200", async () => {
      const existing = { id: "w1", organizationId: "org_123", name: "Old", code: "OLD" };
      const updated = {
        id: "w1",
        organizationId: "org_123",
        name: "Updated",
        code: "NEW",
        address: "Road 1",
      };
      mockDbQuery.warehouses.findFirst.mockResolvedValueOnce(existing);

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updated]),
          }),
        }),
      });

      const ctx = createMockContext({
        params: { id: "w1" },
        body: { name: "Updated", code: "NEW", address: "Road 1", isActive: true },
      });
      const res: any = await WarehousesController.update(ctx);

      expect(res.status).toBe(200);
      expect(res.data.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("returns 404 when warehouse does not exist", async () => {
      mockDbQuery.warehouses.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "w-missing" } });
      const res: any = await WarehousesController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when foreign key constraint 23503 triggers", async () => {
      mockDbQuery.warehouses.findFirst.mockResolvedValueOnce({
        id: "w1",
        organizationId: "org_123",
      });
      const fkErr: any = new Error("FK error");
      fkErr.code = "23503";

      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(fkErr),
      });

      const ctx = createMockContext({ params: { id: "w1" } });
      const res: any = await WarehousesController.remove(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("transaction history");
    });

    it("deletes warehouse cleanly when no history exists", async () => {
      mockDbQuery.warehouses.findFirst.mockResolvedValueOnce({
        id: "w1",
        organizationId: "org_123",
      });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "w1" } });
      const res: any = await WarehousesController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });
});
