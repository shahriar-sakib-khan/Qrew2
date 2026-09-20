import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSTANT_ID, makeConstant, makeCtx, TEMPLATE_ID } from "../../invoice-templates.fixtures";

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
    eq,
    and,
    encodeFormula: vi.fn((f: any) => f),
    templateConstants: {
      id: "id",
      templateId: "templateId",
      token: "token",
      defaultValue: "defaultValue",
      name: "name",
    },
    templateRows: { id: "id", templateId: "templateId", rowToken: "rowToken", formula: "formula" },
    templateSections: { id: "id", templateId: "templateId", sectionToken: "sectionToken" },
    templateSectionCharges: { id: "id", sectionId: "sectionId", formula: "formula" },
    invoiceTemplates: { id: "id", organizationId: "organizationId" },
  };
});

import { db } from "@starter/db";
import { listConstants } from "./list-constants.controller";

function mockSelectReturns(value: any[]) {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(value),
    then: (resolve: any) => resolve(value),
  });
}

describe("listConstants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (db.transaction as any).mockImplementation(async (fn: any) => fn(db));
  });

  it("returns list of constants for templateId", async () => {
    const constants = [makeConstant(), makeConstant({ id: "const-002", token: "PILOTAGE_RATE" })];
    mockSelectReturns(constants);
    const ctx = makeCtx({ params: { templateId: TEMPLATE_ID } });
    const res = await listConstants(ctx);
    expect(res.status).toBe(200);
    expect(Array.isArray((res as any).data)).toBe(true);
  });

  it("returns empty array when template has no constants", async () => {
    mockSelectReturns([]);
    const ctx = makeCtx({ params: { templateId: TEMPLATE_ID } });
    const res = await listConstants(ctx);
    expect(res.status).toBe(200);
    expect((res as any).data).toHaveLength(0);
  });
});
