/**
 * Shared test helpers for invoice-template API unit tests.
 *
 * Strategy: We test each controller method directly by constructing a
 * minimal Hono Context mock. This avoids spinning up an HTTP server while
 * still exercising all controller logic (auth, Zod validation, DB calls).
 *
 * DB calls are mocked via vi.mock("@starter/db") so no real DB connection
 * is needed. Each test can configure db mock return values per scenario.
 */

import { vi } from "vitest";

// ─── Fixture factories ────────────────────────────────────────────────────────

export const ORG_ID = "org-test-001";
export const TEMPLATE_ID = "tpl-test-001";
export const SECTION_ID = "sec-test-001";
export const ROW_ID = "row-test-001";
export const CHARGE_ID = "chg-test-001";

export function makeSection(overrides: Record<string, any> = {}) {
  return {
    id: SECTION_ID,
    templateId: TEMPLATE_ID,
    displayName: "Port Costs",
    description: null,
    sectionToken: "SECTION_PORT_COSTS",
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    rows: [],
    sectionCharges: [],
    ...overrides,
  };
}

export function makeRow(overrides: Record<string, any> = {}) {
  return {
    id: ROW_ID,
    templateId: TEMPLATE_ID,
    sectionId: SECTION_ID,
    parentLabel: "Port Dues",
    rowToken: "PORT_DUES",
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    components: [],
    charges: [],
    ...overrides,
  };
}

export function makeComponent(overrides: Record<string, any> = {}) {
  return {
    id: "comp-001",
    rowId: ROW_ID,
    label: "Base Rate",
    subDescription: null,
    qualifier: null,
    tags: [],
    componentToken: "PORT_DUES_BASE_RATE",
    valueType: "normal",
    formula: null,
    initialValue: null,
    sortOrder: 0,
    ...overrides,
  };
}

export function makeSectionCharge(overrides: Record<string, any> = {}) {
  return {
    id: CHARGE_ID,
    sectionId: SECTION_ID,
    templateId: TEMPLATE_ID,
    label: "Port Levy",
    subDescription: null,
    qualifier: null,
    tags: [],
    chargeToken: "SEC_SECTION_A_PORT_LEVY",
    formulaBase: "BASE",
    formulaRest: "* 0.10",
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ─── Hono Context mock builder ────────────────────────────────────────────────

/**
 * Creates a mock Hono Context object that the controller methods expect.
 *
 * @param opts.orgId - organizationId from auth middleware
 * @param opts.params - route params (templateId, sectionId, etc.)
 * @param opts.body - JSON body (for POST/PATCH)
 */
export function makeContext(opts: {
  orgId?: string;
  params?: Record<string, string>;
  body?: Record<string, any>;
}) {
  const { orgId = ORG_ID, params = {}, body = {} } = opts;

  const jsonResponses: any[] = [];
  const ctx = {
    get: vi.fn((key: string) => {
      if (key === "organizationId") return orgId;
      if (key === "userId") return "user-001";
      return undefined;
    }),
    req: {
      param: vi.fn((key: string) => params[key]),
      json: vi.fn().mockResolvedValue(body),
    },
    json: vi.fn((data: any, status?: number) => {
      jsonResponses.push({ data, status: status ?? 200 });
      return { data, status: status ?? 200 };
    }),
  } as any;

  return { ctx, jsonResponses };
}

// ─── DB mock configurator ─────────────────────────────────────────────────────

/** Access the mocked @starter/db module. Call this AFTER vi.mock("@starter/db"). */
export function getDbMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@starter/db") as ReturnType<typeof buildDbMock>;
}

export function buildDbMock(): any {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
      query: {
        invoiceTemplates: { findFirst: vi.fn() },
        templateSections: { findFirst: vi.fn(), findMany: vi.fn() },
        templateRows: { findFirst: vi.fn(), findMany: vi.fn() },
        templateRowComponents: { findFirst: vi.fn(), findMany: vi.fn() },
        templateRowCharges: { findFirst: vi.fn(), findMany: vi.fn() },
        templateSectionCharges: { findFirst: vi.fn() },
      },
    },
    templateSections: { id: "id", templateId: "templateId", sectionToken: "sectionToken", sortOrder: "sortOrder" },
    templateRows: { id: "id", sectionId: "sectionId", templateId: "templateId", rowToken: "rowToken", sortOrder: "sortOrder" },
    templateRowComponents: { id: "id", rowId: "rowId", componentToken: "componentToken", sortOrder: "sortOrder" },
    templateRowCharges: { id: "id", rowId: "rowId", sortOrder: "sortOrder" },
    templateSectionCharges: { id: "id", sectionId: "sectionId", chargeToken: "chargeToken", sortOrder: "sortOrder" },
    invoiceTemplates: { id: "id", organizationId: "organizationId" },
    eq: vi.fn((_a: any, _b: any) => "eq-condition"),
    and: vi.fn((...args: any[]) => "and-condition"),
    asc: vi.fn((col: any) => "asc-" + col),
  };
}
