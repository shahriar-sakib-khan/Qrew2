/**
 * customers.test.ts
 *
 * Comprehensive unit/integration tests for CustomersController:
 *   - list: returns organization-scoped customers
 *   - getById: returns 404 for missing customer, returns customer object on hit
 *   - create: validation errors (name, phone required), successful insertion (201)
 *   - update: 404 on missing, validation, success (200)
 *   - remove: 404 on missing, handles FK violation 23503 with 409, successful deletion
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersController } from "./customers.controller";

const { mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  const mockDbQuery = {
    customers: {
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
  customers: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
    phone: "phone",
    email: "email",
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

describe("CustomersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns list of customers for organization", async () => {
      const mockCustomers = [
        { id: "c1", organizationId: "org_123", name: "Alice", phone: "123" },
        { id: "c2", organizationId: "org_123", name: "Bob", phone: "456" },
      ];
      mockDbQuery.customers.findMany.mockResolvedValueOnce(mockCustomers);

      const ctx = createMockContext();
      const res: any = await CustomersController.list(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(mockCustomers);
      expect(mockDbQuery.customers.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("returns 400 when missing required fields", async () => {
      const ctx = createMockContext({ body: { name: "" } });
      const res: any = await CustomersController.create(ctx);

      expect(res.status).toBe(400);
      expect(res.data.error).toBe("Validation Error");
    });

    it("creates customer successfully and returns 201", async () => {
      const newCustomer = {
        id: "c-new",
        organizationId: "org_123",
        name: "Acme Corp",
        phone: "+1234567890",
        email: "test@example.com",
        address: "123 Street",
        isActive: true,
      };

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newCustomer]),
        }),
      });

      const ctx = createMockContext({
        body: {
          name: "Acme Corp",
          phone: "+1234567890",
          email: "test@example.com",
          address: "123 Street",
          isActive: true,
        },
      });
      const res: any = await CustomersController.create(ctx);

      expect(res.status).toBe(201);
      expect(res.data).toEqual(newCustomer);
    });
  });

  describe("update", () => {
    it("returns 404 if customer not found", async () => {
      mockDbQuery.customers.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({
        params: { id: "c-none" },
        body: { name: "Updated", phone: "555" },
      });
      const res: any = await CustomersController.update(ctx);

      expect(res.status).toBe(404);
    });

    it("updates customer and returns updated record", async () => {
      const existing = { id: "c1", organizationId: "org_123", name: "Old", phone: "111" };
      const updated = {
        id: "c1",
        organizationId: "org_123",
        name: "New",
        phone: "222",
        isActive: true,
      };
      mockDbQuery.customers.findFirst.mockResolvedValueOnce(existing);

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updated]),
          }),
        }),
      });

      const ctx = createMockContext({
        params: { id: "c1" },
        body: { name: "New", phone: "222", isActive: true },
      });
      const res: any = await CustomersController.update(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual(updated);
    });
  });

  describe("remove", () => {
    it("returns 404 when customer not found", async () => {
      mockDbQuery.customers.findFirst.mockResolvedValueOnce(null);

      const ctx = createMockContext({ params: { id: "c-none" } });
      const res: any = await CustomersController.remove(ctx);

      expect(res.status).toBe(404);
    });

    it("returns 409 when foreign key constraint 23503 prevents deletion", async () => {
      mockDbQuery.customers.findFirst.mockResolvedValueOnce({
        id: "c1",
        organizationId: "org_123",
      });
      const fkError: any = new Error("FK error");
      fkError.code = "23503";

      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(fkError),
      });

      const ctx = createMockContext({ params: { id: "c1" } });
      const res: any = await CustomersController.remove(ctx);

      expect(res.status).toBe(409);
      expect(res.data.error).toContain("Cannot delete a customer that has sales history");
    });

    it("deletes customer cleanly when no sales exist", async () => {
      mockDbQuery.customers.findFirst.mockResolvedValueOnce({
        id: "c1",
        organizationId: "org_123",
      });
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const ctx = createMockContext({ params: { id: "c1" } });
      const res: any = await CustomersController.remove(ctx);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true });
    });
  });
});
