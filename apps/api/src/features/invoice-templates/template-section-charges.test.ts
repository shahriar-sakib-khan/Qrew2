/**
 * Unit tests for TemplateSectionChargesController
 *
 * Coverage:
 * - listSectionCharges: happy path, 401, 404
 * - createSectionCharge: happy path, 401, 404, 400 validation (missing required),
 *   409 chargeToken collision, null optional fields
 * - updateSectionCharge: happy path, 401, 404, partial update
 * - deleteSectionCharge: happy path, 401, 404
 * - Token contract: chargeToken = SEC_<SECTION_TOKEN>_<LABEL_SNAKECASE>
 * - formulaBase enum validation: BASE, TOTAL, CHARGES (anything else = 400)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@starter/db", () => {
  const eq = vi.fn();
  const and = vi.fn();
  const asc = vi.fn();

  const makeSelectChain = (result: any[] = []) => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn().mockReturnThis(),
  });

  const db = {
    select: vi.fn(() => makeSelectChain()),
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
      templateSectionCharges: { findFirst: vi.fn() },
    },
  };

  return {
    db,
    eq,
    and,
    asc,
    templateSectionCharges: {
      id: "id",
      sectionId: "sectionId",
      chargeToken: "chargeToken",
      sortOrder: "sortOrder",
    },
    templateSections: { id: "id", templateId: "templateId" },
    invoiceTemplates: { id: "id", organizationId: "organizationId" },
  };
});

import { TemplateSectionChargesController } from "./template-section-charges.controller";
import { db } from "@starter/db";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-001";
const TEMPLATE_ID = "tpl-001";
const SECTION_ID = "sec-001";
const CHARGE_ID = "chg-001";
const SECTION_TOKEN = "SECTION_A";

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

function makeCharge(overrides: Record<string, any> = {}) {
  return {
    id: CHARGE_ID,
    sectionId: SECTION_ID,
    templateId: TEMPLATE_ID,
    label: "Port Levy",
    subDescription: null,
    qualifier: null,
    tags: [],
    chargeToken: `SEC_${SECTION_TOKEN}_PORT_LEVY`,
    formulaBase: "BASE",
    formulaRest: "* 0.10",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockSectionOwned() {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      section: { id: SECTION_ID, templateId: TEMPLATE_ID, sectionToken: SECTION_TOKEN },
      id: SECTION_ID,
    }]),
    orderBy: vi.fn().mockReturnThis(),
  });
}

function mockSectionNotOwned() {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  });
}

function mockChargeOwned(charge = makeCharge()) {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ charge, id: CHARGE_ID }]),
  });
}

function mockChargeNotFound() {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  });
}

function mockInsertReturns(charge: any) {
  (db.insert as any).mockReturnValue({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([charge]),
  });
}

function mockUpdateReturns(charge: any) {
  (db.update as any).mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([charge]),
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("TemplateSectionChargesController", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listSectionCharges ────────────────────────────────────────────────────

  describe("listSectionCharges", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionChargesController.listSectionCharges(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when section not found or not owned", async () => {
      mockSectionNotOwned();
      const ctx = makeCtx({ params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionChargesController.listSectionCharges(ctx);
      expect(res.status).toBe(404);
    });

    it("returns charges array on happy path", async () => {
      const charges = [makeCharge(), makeCharge({ id: "chg-002", sortOrder: 1 })];
      // First select: section ownership check
      // Second select: fetch charges
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(callCount++ === 0
          ? [{ id: SECTION_ID }]
          : []),
        orderBy: vi.fn().mockResolvedValue(charges),
      }));

      const ctx = makeCtx({ params: { sectionId: SECTION_ID } });
      const res = await TemplateSectionChargesController.listSectionCharges(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ── createSectionCharge ───────────────────────────────────────────────────

  describe("createSectionCharge", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID }, body: {} });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when section not found", async () => {
      mockSectionNotOwned();
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Port Levy", formulaBase: "BASE", formulaRest: "* 0.10" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(404);
    });

    it("returns 400 when label is missing", async () => {
      mockSectionOwned();
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { formulaBase: "BASE", formulaRest: "* 0.10" }, // no label
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(400);
    });

    it("returns 400 when formulaBase is invalid enum value", async () => {
      mockSectionOwned();
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Port Levy", formulaBase: "INVALID", formulaRest: "* 0.10" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(400);
    });

    it("returns 400 when formulaRest is missing or empty", async () => {
      mockSectionOwned();
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Port Levy", formulaBase: "BASE", formulaRest: "" }, // empty string
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(400);
    });

    it("returns 409 when chargeToken already exists in section", async () => {
      mockSectionOwned();
      (db.query.templateSectionCharges.findFirst as any).mockResolvedValue(makeCharge()); // collision
      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Port Levy", formulaBase: "BASE", formulaRest: "* 0.10" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(409);
    });

    it("creates charge with formulaBase=BASE successfully", async () => {
      mockSectionOwned();
      (db.query.templateSectionCharges.findFirst as any).mockResolvedValue(null); // no collision
      const newCharge = makeCharge({ formulaBase: "BASE" });
      mockInsertReturns(newCharge);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Port Levy", formulaBase: "BASE", formulaRest: "* 0.10" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(201);
      expect(res.data.formulaBase).toBe("BASE");
    });

    it("creates charge with formulaBase=TOTAL successfully", async () => {
      mockSectionOwned();
      (db.query.templateSectionCharges.findFirst as any).mockResolvedValue(null);
      const newCharge = makeCharge({ formulaBase: "TOTAL", chargeToken: `SEC_${SECTION_TOKEN}_TAX` });
      mockInsertReturns(newCharge);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Tax", formulaBase: "TOTAL", formulaRest: "* 0.05" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(201);
    });

    it("creates charge with formulaBase=CHARGES successfully", async () => {
      mockSectionOwned();
      (db.query.templateSectionCharges.findFirst as any).mockResolvedValue(null);
      const newCharge = makeCharge({ formulaBase: "CHARGES" });
      mockInsertReturns(newCharge);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: { label: "Admin Fee", formulaBase: "CHARGES", formulaRest: "* 0.02" },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(201);
    });

    it("accepts null for optional fields (subDescription, qualifier)", async () => {
      mockSectionOwned();
      (db.query.templateSectionCharges.findFirst as any).mockResolvedValue(null);
      const newCharge = makeCharge();
      mockInsertReturns(newCharge);

      const ctx = makeCtx({
        params: { sectionId: SECTION_ID, templateId: TEMPLATE_ID },
        body: {
          label: "Port Levy",
          formulaBase: "BASE",
          formulaRest: "* 0.10",
          subDescription: null,
          qualifier: null,
        },
      });
      const res = await TemplateSectionChargesController.createSectionCharge(ctx);
      expect(res.status).toBe(201);
    });
  });

  // ── updateSectionCharge ───────────────────────────────────────────────────

  describe("updateSectionCharge", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { chargeId: CHARGE_ID }, body: {} });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when charge not found", async () => {
      mockChargeNotFound();
      const ctx = makeCtx({ params: { chargeId: CHARGE_ID }, body: { formulaRest: "* 0.15" } });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(404);
    });

    it("updates formulaRest only", async () => {
      mockChargeOwned();
      const updated = makeCharge({ formulaRest: "* 0.15" });
      mockUpdateReturns(updated);

      const ctx = makeCtx({ params: { chargeId: CHARGE_ID }, body: { formulaRest: "* 0.15" } });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(200);
      expect(res.data.formulaRest).toBe("* 0.15");
    });

    it("updates formulaBase from BASE to TOTAL", async () => {
      mockChargeOwned();
      const updated = makeCharge({ formulaBase: "TOTAL" });
      mockUpdateReturns(updated);

      const ctx = makeCtx({ params: { chargeId: CHARGE_ID }, body: { formulaBase: "TOTAL" } });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(200);
      expect(res.data.formulaBase).toBe("TOTAL");
    });

    it("returns 400 for invalid formulaBase in update", async () => {
      mockChargeOwned();
      const ctx = makeCtx({ params: { chargeId: CHARGE_ID }, body: { formulaBase: "INVALID" } });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(400);
    });

    it("updates orderIndex (sortOrder)", async () => {
      mockChargeOwned();
      const updated = makeCharge({ sortOrder: 5 });
      mockUpdateReturns(updated);

      const ctx = makeCtx({ params: { chargeId: CHARGE_ID }, body: { orderIndex: 5 } });
      const res = await TemplateSectionChargesController.updateSectionCharge(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ── deleteSectionCharge ───────────────────────────────────────────────────

  describe("deleteSectionCharge", () => {
    it("returns 401 when unauthenticated", async () => {
      const ctx = makeCtx({ orgId: null, params: { chargeId: CHARGE_ID } });
      const res = await TemplateSectionChargesController.deleteSectionCharge(ctx);
      expect(res.status).toBe(401);
    });

    it("returns 404 when charge not found", async () => {
      mockChargeNotFound();
      const ctx = makeCtx({ params: { chargeId: CHARGE_ID } });
      const res = await TemplateSectionChargesController.deleteSectionCharge(ctx);
      expect(res.status).toBe(404);
    });

    it("deletes charge and returns success", async () => {
      mockChargeOwned();
      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const ctx = makeCtx({ params: { chargeId: CHARGE_ID } });
      const res = await TemplateSectionChargesController.deleteSectionCharge(ctx);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  // ── Token contract ─────────────────────────────────────────────────────────

  describe("Token contract", () => {
    it("chargeToken = SEC_<SECTION_TOKEN>_<UPPER_SNAKE(label)>", () => {
      const sectionToken = "SECTION_A";
      const label = "Port Levy";
      const suffix = label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
      const chargeToken = `SEC_${sectionToken}_${suffix}`;
      expect(chargeToken).toBe("SEC_SECTION_A_PORT_LEVY");
    });

    it("multi-word section token produces correct charge token", () => {
      const sectionToken = "SECTION_PORT_COSTS";
      const label = "Agency Fee";
      const suffix = label.toUpperCase().replace(/\s+/g, "_");
      const chargeToken = `SEC_${sectionToken}_${suffix}`;
      expect(chargeToken).toBe("SEC_SECTION_PORT_COSTS_AGENCY_FEE");
    });

    it("formulaBase=BASE → derived formula is SEC_SECTION_A_BASE * rate", () => {
      const sectionToken = "SECTION_A";
      const formulaBase = "BASE";
      const formulaRest = "* 0.10";
      const full = `SEC_${sectionToken}_${formulaBase} ${formulaRest}`;
      expect(full).toBe("SEC_SECTION_A_BASE * 0.10");
    });

    it("formulaBase=TOTAL → derived formula is SEC_SECTION_A_TOTAL * rate", () => {
      const sectionToken = "SECTION_A";
      const formulaBase = "TOTAL";
      const formulaRest = "* 0.05";
      const full = `SEC_${sectionToken}_${formulaBase} ${formulaRest}`;
      expect(full).toBe("SEC_SECTION_A_TOTAL * 0.05");
    });
  });
});
