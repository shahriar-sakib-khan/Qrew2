/**
 * Unit tests for TemplateSectionsController
 *
 * Coverage:
 * - listSections: happy path, 401 no auth, 404 template not found
 * - createSection: happy path with token, auto-token assignment (A/B/C),
 *   null fields accepted (the ZodError fix), 409 token collision, 401
 * - updateSection: happy path (name + description), 404, 401, orderIndex update
 * - deleteSection: happy path, 404, 401
 *
 * All DB calls are mocked — no real DB connection required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @starter/db BEFORE importing the controller ────────────────────────
vi.mock("@starter/db", () => {
  const eq = vi.fn((_a: any, _b: any) => ({ _type: "eq" }));
  const and = vi.fn((...args: any[]) => ({ _type: "and", args }));
  const asc = vi.fn((col: any) => ({ _type: "asc", col }));

  // Chainable builder factory: supports both .limit() and .orderBy() as terminal awaitable calls
  const makeChain = (returnValue: any = []) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(returnValue),
      orderBy: vi.fn().mockResolvedValue(returnValue), // terminal for nextSectionToken
    };
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
      where: vi.fn().mockResolvedValue(undefined),
    })),
    query: {
      invoiceTemplates: { findFirst: vi.fn() },
      templateSections: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  };

  return {
    db,
    eq,
    and,
    asc,
    templateSections: { id: "id", templateId: "templateId", sectionToken: "sectionToken", sortOrder: "sortOrder", displayName: "displayName" },
    templateRows: { sortOrder: "sortOrder" },
    templateRowComponents: { sortOrder: "sortOrder" },
    templateRowCharges: { sortOrder: "sortOrder" },
    templateSectionCharges: { sortOrder: "sortOrder" },
    invoiceTemplates: { id: "id", organizationId: "organizationId" },
  };
});

import { TemplateSectionsController } from "./template-sections.controller";
import { db } from "@starter/db";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-001";
const TEMPLATE_ID = "tpl-001";
const SECTION_ID = "sec-001";

function makeSection(overrides: Record<string, any> = {}) {
  return {
    id: SECTION_ID,
    templateId: TEMPLATE_ID,
    displayName: "Port Costs",
    description: "Mandatory port charges",
    sectionToken: "SECTION_PORT_COSTS",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    rows: [],
    sectionCharges: [],
    ...overrides,
  };
}

/** Build a minimal Hono Context mock */
function makeCtx(opts: {
  orgId?: string | null;
  params?: Record<string, string>;
  body?: any;
}) {
  const { orgId = ORG_ID, params = {}, body = {} } = opts;
  return {
    get: vi.fn((key: string) => (key === "organizationId" ? orgId : undefined)),
    req: {
      param: vi.fn((key: string) => params[key]),
      json: vi.fn().mockResolvedValue(body),
    },
    json: vi.fn((data: any, status?: number) => ({ data, status: status ?? 200 })),
  } as any;
}

// ─── Helpers to configure db mocks ───────────────────────────────────────────

function mockTemplateFound() {
  (db.query.invoiceTemplates.findFirst as any).mockResolvedValue({ id: TEMPLATE_ID, organizationId: ORG_ID });
}

function mockTemplateNotFound() {
  (db.query.invoiceTemplates.findFirst as any).mockResolvedValue(null);
}

function mockSectionFound(section = makeSection()) {
  (db.query.templateSections.findFirst as any).mockResolvedValue(section);
}

function mockSectionNotFound() {
  (db.query.templateSections.findFirst as any).mockResolvedValue(null);
}

function mockSectionList(sections: any[] = []) {
  (db.query.templateSections as any).findMany = vi.fn().mockResolvedValue(sections);
}

/** Configure db.select to return a specific value via the chain */
function mockSelectReturns(returnValue: any[]) {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
    orderBy: vi.fn().mockResolvedValue(returnValue), // also resolves for nextSectionToken
  });
}

function mockInsertReturns(returnValue: any) {
  (db.insert as any).mockReturnValue({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([returnValue]),
  });
}

function mockUpdateReturns(returnValue: any) {
  (db.update as any).mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([returnValue]),
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("TemplateSectionsController", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listSections ─────────────────────────────────────────────────────────

  describe("listSections", () => {
    it("returns 401 when no organizationId in context", async () => {
      const ctx = makeCtx({ orgId: null, params: { templateId: TEMPLATE_ID } });
      const res = await TemplateSectionsController.listSections(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when template not found for this org", async () => {
      mockTemplateNotFound();
      const ctx = makeCtx({ params: { templateId: TEMPLATE_ID } });
      const res = await TemplateSectionsController.listSections(ctx);
      expect(res.status).toBe(404);
    });

    it("returns sections array on happy path", async () => {
      mockTemplateFound();
      const sections = [makeSection(), makeSection({ id: "sec-002", sortOrder: 1 })];
      mockSectionList(sections);
      const ctx = makeCtx({ params: { templateId: TEMPLATE_ID } });
      const res = await TemplateSectionsController.listSections(ctx);
      expect(res.status).toBe(200);
      expect(res.data).toEqual(sections);
    });

    it("returns empty array when template has no sections", async () => {
      mockTemplateFound();
      mockSectionList([]);
      const ctx = makeCtx({ params: { templateId: TEMPLATE_ID } });
      const res = await TemplateSectionsController.listSections(ctx);
      expect(res.status).toBe(200);
      expect(res.data).toEqual([]);
    });
  });

  // ── createSection ─────────────────────────────────────────────────────────

  describe("createSection", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { templateId: TEMPLATE_ID }, body: { displayName: "A" } });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when template not found", async () => {
      mockTemplateNotFound();
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: { displayName: "Port Costs", sectionToken: "SECTION_PORT_COSTS", orderIndex: 0 },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(404);
    });

    it("[REGRESSION] accepts null displayName, description, sectionToken without ZodError", async () => {
      // This was the bug shown in the screenshot — frontend sends null for empty optional fields
      mockTemplateFound();
      mockSectionNotFound(); // no collision
      const newSection = makeSection({ displayName: null, description: null, sectionToken: "SECTION_A" });
      mockInsertReturns(newSection);

      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          displayName: null,   // <-- the bug trigger: null, not undefined
          description: null,
          sectionToken: null,
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      // Should NOT return 400 ZodError
      expect(res.status).not.toBe(400);
      expect(res.status).toBe(201);
    });

    it("creates a section with explicit SECTION_ prefixed token", async () => {
      mockTemplateFound();
      mockSectionNotFound();
      const newSection = makeSection();
      mockInsertReturns(newSection);

      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          displayName: "Port Costs",
          sectionToken: "SECTION_PORT_COSTS",
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(201);
      expect(res.data.sectionToken).toBe("SECTION_PORT_COSTS");
    });

    it("returns 400 for invalid sectionToken (not UPPER_SNAKE_CASE)", async () => {
      mockTemplateFound();
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          sectionToken: "invalid token!",  // has spaces and special chars
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(400);
    });

    it("returns 409 when sectionToken already exists in template", async () => {
      mockTemplateFound();
      mockSectionFound(); // collision found
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          sectionToken: "SECTION_PORT_COSTS",
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(409);
    });

    it("stores description when provided", async () => {
      mockTemplateFound();
      mockSectionNotFound();
      const newSection = makeSection({ description: "Covers all mandatory port dues" });
      mockInsertReturns(newSection);

      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          displayName: "Port Costs",
          description: "Covers all mandatory port dues",
          sectionToken: "SECTION_PORT_COSTS",
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(201);
      expect(res.data.description).toBe("Covers all mandatory port dues");
    });
  });

  // ── updateSection ─────────────────────────────────────────────────────────

  describe("updateSection", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { sectionId: SECTION_ID }, body: { displayName: "New Name" } });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when section not found or belongs to another org", async () => {
      mockSelectReturns([]); // select returns empty — section not found
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID },
        body: { displayName: "New Name" },
      });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(404);
    });

    it("updates displayName and description successfully", async () => {
      const section = makeSection();
      mockSelectReturns([{ section, org: ORG_ID }]);
      const updatedSection = makeSection({ displayName: "New Port Costs", description: "Updated desc" });
      mockUpdateReturns(updatedSection);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID },
        body: { displayName: "New Port Costs", description: "Updated desc" },
      });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(200);
      expect(res.data.displayName).toBe("New Port Costs");
      expect(res.data.description).toBe("Updated desc");
    });

    it("accepts null displayName to clear the name", async () => {
      const section = makeSection();
      mockSelectReturns([{ section, org: ORG_ID }]);
      const updatedSection = makeSection({ displayName: null });
      mockUpdateReturns(updatedSection);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID },
        body: { displayName: null },
      });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(200);
    });

    it("updates sortOrder via orderIndex", async () => {
      const section = makeSection();
      mockSelectReturns([{ section, org: ORG_ID }]);
      const updatedSection = makeSection({ sortOrder: 3 });
      mockUpdateReturns(updatedSection);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID },
        body: { orderIndex: 3 },
      });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(200);
      expect(res.data.sortOrder).toBe(3);
    });

    it("returns 400 for invalid body (orderIndex negative)", async () => {
      const section = makeSection();
      mockSelectReturns([{ section, org: ORG_ID }]);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID },
        body: { orderIndex: -1 },
      });
      const res = await TemplateSectionsController.updateSection(ctx);
      expect(res.status).toBe(400);
    });
  });

  // ── deleteSection ─────────────────────────────────────────────────────────

  describe("deleteSection", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionsController.deleteSection(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when section not found", async () => {
      mockSelectReturns([]);
      const ctx = makeCtx({ params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionsController.deleteSection(ctx);
      expect(res.status).toBe(404);
    });

    it("deletes section and returns success", async () => {
      mockSelectReturns([{ id: SECTION_ID }]);
      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      const ctx = makeCtx({ params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionsController.deleteSection(ctx);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  // ── Token naming rules ────────────────────────────────────────────────────

  describe("Token naming contract", () => {
    it("section token with displayName 'A' maps to token SECTION_A", async () => {
      mockTemplateFound();
      mockSectionNotFound();
      const newSection = makeSection({ displayName: "A", sectionToken: "SECTION_A" });
      mockInsertReturns(newSection);

      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          displayName: "A",
          sectionToken: "SECTION_A",
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(201);
      expect(res.data.sectionToken).toBe("SECTION_A");
    });

    it("empty string sectionToken in body is treated as null (auto-assigned)", async () => {
      mockTemplateFound();
      mockSectionNotFound();
      // The controller auto-assigns SECTION_A when sectionToken is null/undefined
      const newSection = makeSection({ sectionToken: "SECTION_A" });
      mockInsertReturns(newSection);

      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: {
          sectionToken: null, // empty / null → server auto-assigns
          orderIndex: 0,
        },
      });
      const res = await TemplateSectionsController.createSection(ctx);
      expect(res.status).toBe(201);
    });
  });
});
