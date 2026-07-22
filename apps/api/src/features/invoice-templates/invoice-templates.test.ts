/**
 * Unit tests for InvoiceTemplatesController
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock @starter/db ────────────────────────────────────────────────────────
vi.mock("@starter/db", () => {
  const eq = vi.fn((_a: any, _b: any) => ({ _type: "eq" }));
  const and = vi.fn((...args: any[]) => ({ _type: "and", args }));

  const makeChain = (returnValue: any = []) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(returnValue),
    };
    // If it's awaited without limit/where/etc
    chain.then = (resolve: any) => resolve(returnValue);
    return chain;
  };

  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })),
  };

  return {
    db,
    eq,
    and,
    invoiceTemplates: { id: "id", organizationId: "organizationId", documentType: "documentType", name: "name", description: "description" },
    templateHeaderFields: { id: "id" },
    invoiceTypes: { id: "id", name: "name" },
    templateSections: { id: "id" },
    customFieldDefinitions: { id: "id", organizationId: "organizationId", entityType: "entityType" },
  };
});

import { InvoiceTemplatesController } from "./invoice-templates.controller";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-001";
const USER_ID = "user-001";
const TEMPLATE_ID = "tpl-001";

function makeCtx(opts: {
  orgId?: string | null;
  params?: Record<string, string>;
  body?: any;
}) {
  const { orgId = ORG_ID, params = {}, body = {} } = opts;
  return {
    get: (key: string) => {
      if (key === "user") return { id: USER_ID };
      if (key === "organizationId") return orgId;
      return null;
    },
    req: {
      param: (key: string) => params[key],
      json: async () => body,
    },
    json: (data: any, status = 200) => ({ data, status }),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InvoiceTemplatesController", () => {
  describe("listTemplates", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null });
      const res = await InvoiceTemplatesController.listTemplates(ctx);
      expect(res.status).toBe(401);
    });

    it("returns list of templates", async () => {
      const ctx = makeCtx({});
      const res = await InvoiceTemplatesController.listTemplates(ctx);
      expect(res.status).toBe(200);
      expect(Array.isArray((res as any).data)).toBe(true);
    });
  });

  describe("getTemplate", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { id: TEMPLATE_ID } });
      const res = await InvoiceTemplatesController.getTemplate(ctx);
      expect(res.status).toBe(401);
    });
  });

  describe("createTemplate", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, body: { name: "Test" } });
      const res = await InvoiceTemplatesController.createTemplate(ctx);
      expect(res.status).toBe(401);
    });
  });

  describe("updateTemplate", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { id: TEMPLATE_ID }, body: { name: "Test" } });
      const res = await InvoiceTemplatesController.updateTemplate(ctx);
      expect(res.status).toBe(401);
    });
  });

  describe("deleteTemplate", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { id: TEMPLATE_ID } });
      const res = await InvoiceTemplatesController.deleteTemplate(ctx);
      expect(res.status).toBe(401);
    });
  });
});
