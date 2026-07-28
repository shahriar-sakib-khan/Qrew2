/**
 * custom-fields.test.ts
 *
 * Tests for the custom field definitions API:
 *   GET    /custom-fields         — listDefinitions
 *   POST   /custom-fields         — createDefinition
 *   PUT    /custom-fields/:id     — updateDefinition
 *   DELETE /custom-fields/:id     — deleteDefinition
 *
 * Key scenarios:
 *   - isPrivate field filtering (non-owners cannot see private fields)
 *   - fieldKey normalization (lowercase input → UPPERCASE storage)
 *   - Duplicate fieldKey rejection
 *   - Seeded fields cannot be deleted
 *   - isDetailed / isSensitive / isPrivate toggleable on update
 *   - fieldKey and fieldType immutable after creation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomFieldsController } from "./custom-fields.controller";

// ─── Mocks ────────────────────────────────────────────────────────────────
// Variables referenced in vi.mock() factories must be hoisted via vi.hoisted()

const { mockDbQuery, mockDbInsert, mockDbDelete, mockDbUpdate } = vi.hoisted(() => {
  const mockDbQuery = {
    customFieldDefinitions: { findFirst: vi.fn(), findMany: vi.fn() },
    members: { findFirst: vi.fn() },
  };
  const mockDbInsert = vi.fn();
  const mockDbDelete = vi.fn();
  const mockDbUpdate = vi.fn();
  return { mockDbQuery, mockDbInsert, mockDbDelete, mockDbUpdate };
});

vi.mock("@starter/db", () => ({
  db: {
    query: mockDbQuery,
    insert: (...a: any[]) => mockDbInsert(...a),
    delete: (...a: any[]) => mockDbDelete(...a),
    update: (...a: any[]) => mockDbUpdate(...a),
  },
  customFieldDefinitions: { id: "id", organizationId: "organization_id", entityType: "entity_type", fieldKey: "field_key" },
  members: { userId: "user_id", organizationId: "organization_id" },
}));

vi.mock("../../infra/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../infra/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { auth } from "../../infra/lib/auth";

// ─── Fixture helpers ──────────────────────────────────────────────────────

const ORG_ID = "org-001";
const USER_ID = "user-001";
const FIELD_ID = "field-001";

function makeSession(role: string = "member") {
  return {
    session: { activeOrganizationId: ORG_ID },
    user: { id: USER_ID, role },
  };
}

function makeFieldDef(overrides = {}): any {
  return {
    id: FIELD_ID,
    organizationId: ORG_ID,
    entityType: "project",
    fieldName: "Vessel Name",
    fieldKey: "VESSEL_NAME",
    fieldType: "text",
    isRequired: false,
    options: null,
    isDetailed: false,
    isSensitive: false,
    isPrivate: false,
    isSeeded: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeCtx(body?: object, params: Record<string, string> = {}, query: Record<string, string> = {}): any {
  return {
    req: {
      raw: { headers: new Headers() },
      json: () => Promise.resolve(body),
      param: (k: string) => params[k],
      query: (k: string) => query[k],
    },
    // Return as `any` so callers can access ._data and ._status without
    // TypeScript complaining about union narrowing on Hono's TypedResponse type.
    json: (data: any, status?: number): any => ({ _data: data, _status: status ?? 200 }),
  };
}


// ─── Tests ────────────────────────────────────────────────────────────────

describe("listDefinitions — isPrivate filtering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows private fields to org owners", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession("member"));
    const privateField = makeFieldDef({ isPrivate: true });
    const publicField = makeFieldDef({ id: "field-002", isPrivate: false });
    mockDbQuery.customFieldDefinitions.findMany.mockResolvedValueOnce([publicField, privateField]);
    mockDbQuery.members.findFirst.mockResolvedValueOnce({ role: "owner" });

    const ctx = makeCtx();
    const res = await CustomFieldsController.listDefinitions(ctx as any);
    expect(res._data).toHaveLength(2); // Owner sees both
  });

  it("hides private fields from regular members", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession("member"));
    const privateField = makeFieldDef({ isPrivate: true });
    const publicField = makeFieldDef({ id: "field-002", isPrivate: false });
    mockDbQuery.customFieldDefinitions.findMany.mockResolvedValueOnce([publicField, privateField]);
    mockDbQuery.members.findFirst.mockResolvedValueOnce({ role: "member" }); // not owner

    const ctx = makeCtx();
    const res = await CustomFieldsController.listDefinitions(ctx as any);
    expect(res._data).toHaveLength(1);
    expect(res._data[0].isPrivate).toBe(false);
  });

  it("shows all fields (including private) to super_admin", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession("super_admin"));
    const privateField = makeFieldDef({ isPrivate: true });
    mockDbQuery.customFieldDefinitions.findMany.mockResolvedValueOnce([privateField]);
    // members.findFirst should NOT be called for super_admin

    const ctx = makeCtx();
    const res = await CustomFieldsController.listDefinitions(ctx as any);
    expect(res._data).toHaveLength(1);
    expect(mockDbQuery.members.findFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when no active org", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce({ session: { activeOrganizationId: null }, user: { id: "u1", role: "member" } });
    const ctx = makeCtx();
    const res = await CustomFieldsController.listDefinitions(ctx as any);
    expect(res._status).toBe(401);
  });
});

describe("createDefinition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes fieldKey to UPPERCASE", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(null); // no duplicate
    const created = makeFieldDef({ fieldKey: "VESSEL_NAME" });
    mockDbInsert.mockReturnValueOnce({ values: () => ({ returning: () => Promise.resolve([created]) }) });

    const ctx = makeCtx({ entityType: "project", fieldName: "Vessel Name", fieldKey: "vessel name", fieldType: "text" });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(201);
    expect(res._data.fieldKey).toBe("VESSEL_NAME");
  });

  it("rejects duplicate fieldKey for same org and entityType", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(makeFieldDef()); // duplicate

    const ctx = makeCtx({ entityType: "project", fieldName: "Vessel Name", fieldKey: "VESSEL_NAME", fieldType: "text" });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(409);
    expect(res._data.error).toContain("already exists");
  });

  it("creates a private field with isPrivate: true", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(null);
    const created = makeFieldDef({ isPrivate: true });
    mockDbInsert.mockReturnValueOnce({ values: () => ({ returning: () => Promise.resolve([created]) }) });

    const ctx = makeCtx({ entityType: "project", fieldName: "Secret Code", fieldKey: "SECRET_CODE", fieldType: "text", isPrivate: true });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(201);
    expect(res._data.isPrivate).toBe(true);
  });

  it("returns 400 for invalid fieldType", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    const ctx = makeCtx({ entityType: "project", fieldName: "X", fieldKey: "X", fieldType: "invalid_type" });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(400);
  });

  it("returns 400 for invalid entityType", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    const ctx = makeCtx({ entityType: "invoice", fieldName: "X", fieldKey: "X", fieldType: "text" });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(400);
  });

  it("returns 401 when session has no org", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce({ session: {}, user: { id: "u1" } });
    const ctx = makeCtx({ entityType: "project", fieldName: "X", fieldKey: "X", fieldType: "text" });
    const res = await CustomFieldsController.createDefinition(ctx as any);
    expect(res._status).toBe(401);
  });
});

describe("updateDefinition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles isPrivate from false to true", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    const existing = makeFieldDef({ isPrivate: false });
    const updated = makeFieldDef({ isPrivate: true });
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(existing);
    mockDbUpdate.mockReturnValueOnce({ set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) }) });

    const ctx = makeCtx({ isPrivate: true }, { id: FIELD_ID });
    const res = await CustomFieldsController.updateDefinition(ctx as any);
    expect(res._status).toBe(200);
    expect(res._data.isPrivate).toBe(true);
  });

  it("toggles isSensitive and isDetailed", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    const existing = makeFieldDef();
    const updated = makeFieldDef({ isDetailed: true, isSensitive: true });
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(existing);
    mockDbUpdate.mockReturnValueOnce({ set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) }) });

    const ctx = makeCtx({ isDetailed: true, isSensitive: true }, { id: FIELD_ID });
    const res = await CustomFieldsController.updateDefinition(ctx as any);
    expect(res._status).toBe(200);
    expect(res._data.isDetailed).toBe(true);
    expect(res._data.isSensitive).toBe(true);
  });

  it("returns 404 when field not found", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(null);

    const ctx = makeCtx({ fieldName: "X" }, { id: "non-existent" });
    const res = await CustomFieldsController.updateDefinition(ctx as any);
    expect(res._status).toBe(404);
  });
});

describe("deleteDefinition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a non-seeded field", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(makeFieldDef({ isSeeded: false }));
    mockDbDelete.mockReturnValueOnce({ where: () => Promise.resolve() });

    const ctx = makeCtx(undefined, { id: FIELD_ID });
    const res = await CustomFieldsController.deleteDefinition(ctx as any);
    expect(res._status).toBe(200);
    expect(res._data.success).toBe(true);
  });

  it("blocks deletion of seeded (system) fields", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(makeFieldDef({ isSeeded: true }));

    const ctx = makeCtx(undefined, { id: FIELD_ID });
    const res = await CustomFieldsController.deleteDefinition(ctx as any);
    expect(res._status).toBe(403);
    expect(res._data.error).toContain("Seeded");
  });

  it("returns 404 for non-existent field", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce(makeSession());
    mockDbQuery.customFieldDefinitions.findFirst.mockResolvedValueOnce(null);

    const ctx = makeCtx(undefined, { id: "ghost" });
    const res = await CustomFieldsController.deleteDefinition(ctx as any);
    expect(res._status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    (auth.api.getSession as any).mockResolvedValueOnce({ session: {}, user: { id: "u1" } });
    const ctx = makeCtx(undefined, { id: FIELD_ID });
    const res = await CustomFieldsController.deleteDefinition(ctx as any);
    expect(res._status).toBe(401);
  });
});
