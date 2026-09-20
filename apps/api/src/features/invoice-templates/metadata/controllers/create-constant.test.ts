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

import { createConstant } from "./create-constant.controller";
import { db } from "@starter/db";

function mockInsertReturns(value: any) {
  (db.insert as any).mockReturnValue({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([value]),
  });
}

describe("createConstant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (db.transaction as any).mockImplementation(async (fn: any) => fn(db));
  });

  it("creates constant with 201 on happy path", async () => {
    const constant = makeConstant();
    mockInsertReturns(constant);
    const ctx = makeCtx({
      params: { templateId: TEMPLATE_ID },
      body: { key: "FUEL_RATE", valueType: "number", value: "3.5" },
    });
    const res = await createConstant(ctx);
    expect(res.status).toBe(201);
  });

  it("returns 400 when key contains lowercase letters (fails regex)", async () => {
    const ctx = makeCtx({
      params: { templateId: TEMPLATE_ID },
      body: { key: "fuel_rate", valueType: "number" },
    });
    const res = await createConstant(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when valueType is not a valid enum value", async () => {
    const ctx = makeCtx({
      params: { templateId: TEMPLATE_ID },
      body: { key: "FUEL_RATE", valueType: "invalid_type" },
    });
    const res = await createConstant(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when key is missing", async () => {
    const ctx = makeCtx({
      params: { templateId: TEMPLATE_ID },
      body: { valueType: "number" },
    });
    const res = await createConstant(ctx);
    expect(res.status).toBe(400);
  });

  describe("Field mapping contract", () => {
    it("maps 'key' → 'token' in DB insert", async () => {
      let insertedValues: any;
      (db.insert as any).mockReturnValue({
        values: vi.fn((v: any) => { insertedValues = v; return { returning: vi.fn().mockResolvedValue([makeConstant()]) }; }),
      });
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: { key: "FUEL_RATE", valueType: "number", value: "3.5", description: "Fuel price" },
      });
      await createConstant(ctx);
      expect(insertedValues.token).toBe("FUEL_RATE");
      expect(insertedValues.key).toBeUndefined();
    });

    it("maps 'value' → 'defaultValue' in DB insert", async () => {
      let insertedValues: any;
      (db.insert as any).mockReturnValue({
        values: vi.fn((v: any) => { insertedValues = v; return { returning: vi.fn().mockResolvedValue([makeConstant()]) }; }),
      });
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: { key: "FUEL_RATE", valueType: "number", value: "3.5" },
      });
      await createConstant(ctx);
      expect(insertedValues.defaultValue).toBe("3.5");
      expect(insertedValues.value).toBeUndefined();
    });

    it("maps 'description' → 'name' in DB insert", async () => {
      let insertedValues: any;
      (db.insert as any).mockReturnValue({
        values: vi.fn((v: any) => { insertedValues = v; return { returning: vi.fn().mockResolvedValue([makeConstant()]) }; }),
      });
      const ctx = makeCtx({
        params: { templateId: TEMPLATE_ID },
        body: { key: "FUEL_RATE", valueType: "number", description: "Fuel price" },
      });
      await createConstant(ctx);
      expect(insertedValues.name).toBe("Fuel price");
      expect(insertedValues.description).toBeUndefined();
    });
  });
});
