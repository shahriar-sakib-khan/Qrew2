/**
 * Template Rows Controller — V3
 *
 * Single-value row model. No sub-components.
 * Formula storage: {{$row:UUID}} references (encode on write, decode on read).
 *
 * Token contract:
 *   rowToken           = row display name / formula token (mutable, unique per template)
 *   rowToken + "_TOTAL" = base + sum of row charges  (derived at eval time)
 */

import { Context } from "hono";
import {
  db,
  templateRows,
  templateRowComponents,
  templateRowCharges,
  templateSections,
  invoiceTemplates,
  encodeFormula,
  decodeFormula,
  type RowTokenToIdMap,
  type RowIdToTokenMap,
} from "@starter/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build token↔id lookup maps for all rows in a template. */
async function buildRowIndex(templateId: string): Promise<{
  tokenToId: RowTokenToIdMap;
  idToToken: RowIdToTokenMap;
}> {
  const rows = await db
    .select({ id: templateRows.id, rowToken: templateRows.rowToken })
    .from(templateRows)
    .where(eq(templateRows.templateId, templateId));

  const tokenToId: RowTokenToIdMap = {};
  const idToToken: RowIdToTokenMap = {};
  for (const row of rows) {
    tokenToId[row.rowToken] = row.id;
    idToToken[row.id] = row.rowToken;
  }
  return { tokenToId, idToToken };
}

/** Convert a label string to SNAKE_CASE token suffix. */
function toSnakeCase(label: string): string {
  return label
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const rowChargeSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  formula: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const createRowSchema = z.object({
  // Empty string is allowed — label is filled in inline on the table after creation
  parentLabel: z.string().default(""),
  rowToken: z
    .string()
    .min(1)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "rowToken must be UPPER_SNAKE_CASE with no leading, trailing, or consecutive underscores"),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
  charges: z.array(rowChargeSchema).optional().default([]),
});

const updateRowSchema = z.object({
  // Allow empty string to clear a label
  parentLabel: z.string().optional(),
  rowToken: z
    .string()
    .min(1)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "rowToken must be UPPER_SNAKE_CASE with no leading, trailing, or consecutive underscores")
    .optional(),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
  // Value fields (set via formula bar)
  valueType: z.enum(["normal", "formula"]).optional(),
  formula: z.string().optional().nullable(),
  initialValue: z.number().optional().nullable(),
  // Charges (full replace)
  charges: z.array(rowChargeSchema).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

export class TemplateRowsController {
  /** GET /:templateId/sections/:sectionId/rows */
  static async listRows(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Verify ownership
    const secCheck = await db
      .select({ id: templateSections.id })
      .from(templateSections)
      .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
      .where(
        and(
          eq(templateSections.id, sectionId),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);
    if (secCheck.length === 0) return c.json({ error: "Section not found" }, 404);

    // Build id→token map for formula decoding
    const { idToToken } = await buildRowIndex(templateId);

    const rows = await db.query.templateRows.findMany({
      where: eq(templateRows.sectionId, sectionId),
      orderBy: [asc(templateRows.sortOrder)],
      with: {
        charges: { orderBy: [asc(templateRowCharges.sortOrder)] },
      },
    });

    // Decode formulas before sending to frontend
    const decoded = rows.map((row) => ({
      ...row,
      formula: decodeFormula(row.formula, idToToken),
      charges: row.charges.map((ch) => ({
        ...ch,
        formula: decodeFormula(ch.formula, idToToken) ?? ch.formula,
      })),
    }));

    return c.json({ rows: decoded, rowIndex: idToToken });
  }

  /** POST /:templateId/sections/:sectionId/rows */
  static async createRow(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Verify section ownership and get templateId
    const secResult = await db
      .select({
        section: templateSections,
        templateOrgId: invoiceTemplates.organizationId,
      })
      .from(templateSections)
      .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
      .where(
        and(
          eq(templateSections.id, sectionId),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);
    if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

    const templateId = secResult[0].section.templateId;

    const body = await c.req.json();
    const parsed = createRowSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const { rowToken, parentLabel, description, orderIndex, charges } = parsed.data;

    // Token uniqueness check
    const existingRow = await db.query.templateRows.findFirst({
      where: and(eq(templateRows.templateId, templateId), eq(templateRows.rowToken, rowToken)),
    });
    if (existingRow) {
      return c.json({ error: `rowToken "${rowToken}" is already used in this template.` }, 409);
    }

    // Build row index for formula encoding
    const { tokenToId, idToToken } = await buildRowIndex(templateId);

    // Assign sortOrder = max existing sortOrder + 1 so new rows always go to the bottom.
    // We deliberately ignore any client-sent orderIndex for simplicity and consistency.
    const existingSortOrders = await db
      .select({ sortOrder: templateRows.sortOrder })
      .from(templateRows)
      .where(eq(templateRows.sectionId, sectionId));
    const maxSortOrder = existingSortOrders.reduce(
      (max, r) => Math.max(max, r.sortOrder ?? 0),
      -1
    );
    const newSortOrder = maxSortOrder + 1;

    const result = await db.transaction(async (tx) => {
      const rowId = crypto.randomUUID();

      // Add new row to token map so charges can reference it
      tokenToId[rowToken] = rowId;
      idToToken[rowId] = rowToken;

      const [row] = await tx
        .insert(templateRows)
        .values({
          id: rowId,
          templateId,
          sectionId,
          parentLabel,
          rowToken,
          description: description ?? null,
          valueType: "normal",
          formula: null,
          initialValue: null,
          sortOrder: newSortOrder,
        })
        .returning();

      // Insert row charges
      const insertedCharges = await Promise.all(
        (charges ?? []).map((charge, i) =>
          tx
            .insert(templateRowCharges)
            .values({
              id: crypto.randomUUID(),
              rowId: row.id,
              label: charge.label,
              subDescription: charge.subDescription ?? null,
              qualifier: charge.qualifier ?? null,
              tags: charge.tags ?? [],
              chargeToken: `${rowToken}_${toSnakeCase(charge.label)}`,
              formula: encodeFormula(charge.formula, tokenToId) ?? charge.formula,
              sortOrder: charge.sortOrder ?? i,
            })
            .returning()
            .then((r) => r[0])
        )
      );

      return {
        ...row,
        formula: decodeFormula(row.formula, idToToken),
        charges: insertedCharges.map((ch) => ({
          ...ch,
          formula: decodeFormula(ch.formula, idToToken) ?? ch.formula,
        })),
      };
    });

    return c.json(result, 201);
  }

  /** PATCH /:templateId/sections/:sectionId/rows/:rowId */
  static async updateRow(c: Context): Promise<any> {
    const rowId = c.req.param("rowId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Ownership check
    const rowCheck = await db
      .select({ row: templateRows, orgId: invoiceTemplates.organizationId })
      .from(templateRows)
      .innerJoin(invoiceTemplates, eq(templateRows.templateId, invoiceTemplates.id))
      .where(and(eq(templateRows.id, rowId), eq(invoiceTemplates.organizationId, organizationId)))
      .limit(1);

    if (rowCheck.length === 0) return c.json({ error: "Row not found" }, 404);
    const existingRow = rowCheck[0].row;

    const body = await c.req.json();
    const parsed = updateRowSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const newRowToken = parsed.data.rowToken ?? existingRow.rowToken;

    // Check rowToken uniqueness if changing
    if (parsed.data.rowToken && parsed.data.rowToken !== existingRow.rowToken) {
      const dup = await db.query.templateRows.findFirst({
        where: and(
          eq(templateRows.templateId, existingRow.templateId),
          eq(templateRows.rowToken, parsed.data.rowToken)
        ),
      });
      if (dup) {
        return c.json({ error: `rowToken "${parsed.data.rowToken}" is already used in this template.` }, 409);
      }
    }

    // Build row index for formula encoding/decoding
    const { tokenToId, idToToken } = await buildRowIndex(existingRow.templateId);

    // If the rowToken is changing, update the maps to reflect the new name
    if (parsed.data.rowToken && parsed.data.rowToken !== existingRow.rowToken) {
      delete tokenToId[existingRow.rowToken];
      tokenToId[newRowToken] = rowId;
      idToToken[rowId] = newRowToken;
    }

    const result = await db.transaction(async (tx) => {
      // Build update fields
      const updateFields: any = {};
      if (parsed.data.parentLabel !== undefined) updateFields.parentLabel = parsed.data.parentLabel;
      if (parsed.data.rowToken !== undefined) updateFields.rowToken = parsed.data.rowToken;
      if (parsed.data.description !== undefined) updateFields.description = parsed.data.description;
      if (parsed.data.orderIndex !== undefined) updateFields.sortOrder = parsed.data.orderIndex;
      if (parsed.data.valueType !== undefined) updateFields.valueType = parsed.data.valueType;
      if (parsed.data.formula !== undefined) {
        updateFields.formula = parsed.data.valueType === "formula" || (parsed.data.formula && parsed.data.formula.trim())
          ? encodeFormula(parsed.data.formula, tokenToId)
          : null;
        // If setting a formula, clear initialValue
        if (parsed.data.formula) updateFields.initialValue = null;
      }
      if (parsed.data.initialValue !== undefined) {
        updateFields.initialValue = parsed.data.initialValue != null ? String(parsed.data.initialValue) : null;
        // If setting initialValue, clear formula
        if (parsed.data.initialValue != null) updateFields.formula = null;
      }

      if (Object.keys(updateFields).length === 0 && parsed.data.charges === undefined) {
        return c.json({ error: "No values to set" }, 400);
      }

      let updatedRow = existingRow;
      if (Object.keys(updateFields).length > 0) {
        const [row] = await tx
          .update(templateRows)
          .set(updateFields)
          .where(eq(templateRows.id, rowId))
          .returning();
        updatedRow = row;
      }

      // Full-replace charges if provided
      let finalCharges: any[] = [];
      if (parsed.data.charges !== undefined) {
        await tx.delete(templateRowCharges).where(eq(templateRowCharges.rowId, rowId));
        finalCharges = await Promise.all(
          parsed.data.charges.map((charge, i) =>
            tx
              .insert(templateRowCharges)
              .values({
                id: crypto.randomUUID(),
                rowId,
                label: charge.label,
                subDescription: charge.subDescription ?? null,
                qualifier: charge.qualifier ?? null,
                tags: charge.tags ?? [],
                chargeToken: `${newRowToken}_${toSnakeCase(charge.label)}`,
                formula: encodeFormula(charge.formula, tokenToId) ?? charge.formula,
                sortOrder: charge.sortOrder ?? i,
              })
              .returning()
              .then((r) => r[0])
          )
        );
      } else {
        finalCharges = await tx.query.templateRowCharges.findMany({
          where: eq(templateRowCharges.rowId, rowId),
          orderBy: [asc(templateRowCharges.sortOrder)],
        });
      }

      return {
        ...updatedRow,
        formula: decodeFormula(updatedRow.formula, idToToken),
        charges: finalCharges.map((ch) => ({
          ...ch,
          formula: decodeFormula(ch.formula, idToToken) ?? ch.formula,
        })),
      };
    });

    return c.json(result);
  }

  /** DELETE /:templateId/sections/:sectionId/rows/:rowId */
  static async deleteRow(c: Context) {
    const rowId = c.req.param("rowId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const rowCheck = await db
      .select({ id: templateRows.id })
      .from(templateRows)
      .innerJoin(invoiceTemplates, eq(templateRows.templateId, invoiceTemplates.id))
      .where(and(eq(templateRows.id, rowId), eq(invoiceTemplates.organizationId, organizationId)))
      .limit(1);

    if (rowCheck.length === 0) return c.json({ error: "Row not found" }, 404);

    // Charges delete via FK CASCADE
    await db.delete(templateRows).where(eq(templateRows.id, rowId));

    return c.json({ success: true });
  }

  /**
   * PUT /:templateId/sections/:sectionId/rows/reorder
   *
   * Accepts { orderedIds: string[] } — the complete ordered list of row IDs
   * for this section — and bulk-updates every row's sortOrder to its index in
   * that array.  This is the only correct way to handle drag-and-drop reorder
   * because simply swapping two rows' sortOrders can leave duplicates when
   * moving across multiple positions.
   */
  static async reorderRows(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Verify section ownership
    const secResult = await db
      .select({ section: templateSections })
      .from(templateSections)
      .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
      .where(
        and(
          eq(templateSections.id, sectionId),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);
    if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

    const body = await c.req.json();
    const parsed = z.object({ orderedIds: z.array(z.string().uuid()) }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const { orderedIds } = parsed.data;

    // Bulk-update every row's sortOrder to its position in the list
    await db.transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx
            .update(templateRows)
            .set({ sortOrder: index })
            .where(
              and(
                eq(templateRows.id, id),
                eq(templateRows.sectionId, sectionId)
              )
            )
        )
      );
    });

    return c.json({ success: true });
  }
}
