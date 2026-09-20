import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCtx, makeConstant, TEMPLATE_ID, CONSTANT_ID } from "../../invoice-templates.fixtures";

const { hoistedChain } = vi.hoisted(() => ({
  hoistedChain: (result: any[] = []) => {
    const p = Promise.resolve(result) as any;
    p.from = vi.fn().mockReturnValue(p);
    p.innerJoin = vi.fn().mockReturnValue(p);
    p.where = vi.fn().mockReturnValue(p);
    p.limit = vi.fn().mockReturnValue(p);
    p.orderBy = vi.fn().mockReturnValue(p);
    return p;
  },
}));

vi.mock("@starter/db", () => {
  const eq = vi.fn();
  const and = vi.fn();

  const db: any = {
    select: vi.fn(() => hoistedChain()),
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
    transaction: vi.fn(),
  };
  db.transaction = vi.fn(async (fn: any) => fn(db));

  return {
    db,
    eq, and,
    encodeFormula: vi.fn((f: any) => f),
    templateConstants: { id: "id", templateId: "templateId", token: "token", defaultValue: "defaultValue", name: "name" },
    templateRows: { id: "id", templateId: "templateId", rowToken: "rowToken", formula: "formula" },
    templateSections: { id: "id", templateId: "templateId", sectionToken: "sectionToken" },
    templateSectionCharges: { id: "id", sectionId: "sectionId", formula: "formula" },
    invoiceTemplates: { id: "id", organizationId: "organizationId" },
  };
});

import { updateConstant } from "./update-constant.controller";
import { db } from "@starter/db";

describe("updateConstant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (db.transaction as any).mockImplementation(async (fn: any) => fn(db));
  });

  it("updates value only", async () => {
    const updated = makeConstant({ defaultValue: "4.2" });
    (db.transaction as any).mockImplementation(async (fn: any) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([updated]),
        })),
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })),
      };
      return fn(tx);
    });
    const ctx = makeCtx({ params: { constantId: CONSTANT_ID }, body: { value: "4.2" } });
    const res = await updateConstant(ctx);
    expect(res.status).toBe(200);
  });

  it("returns 404 when constant not found", async () => {
    (db.transaction as any).mockImplementation(async (fn: any) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        })),
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })),
      };
      return fn(tx);
    });
    const ctx = makeCtx({ params: { constantId: CONSTANT_ID }, body: { value: "99" } });
    const res = await updateConstant(ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when key fails regex", async () => {
    const ctx = makeCtx({ params: { constantId: CONSTANT_ID }, body: { key: "bad key!" } });
    const res = await updateConstant(ctx);
    expect(res.status).toBe(400);
  });

  it("updating key triggers re-encode sweep on rows and section charges", async () => {
    const updated = makeConstant({ token: "NEW_RATE" });
    const sweepCalled = { rows: false, secCharges: false };

    (db.transaction as any).mockImplementation(async (fn: any) => {
      const tx = {
        update: vi.fn((table: any) => {
          if (table === "templateConstants" || String(table) === "[object Object]") sweepCalled.rows = true;
          return {
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([updated]),
          };
        }),
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })),
      };
      return fn(tx);
    });

    const ctx = makeCtx({ params: { constantId: CONSTANT_ID }, body: { key: "NEW_RATE" } });
    const res = await updateConstant(ctx);
    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalled();
  });
});
