import {
  db,
  decodeFormula,
  encodeFormula,
  invoiceTemplates,
  templateRowCharges,
  templateRows,
  templateSections,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { z } from "zod";
import { buildConstantIndex } from "../../metadata/services/constant-index.service";
import { buildSectionIndex } from "../../sections/services/section-index.service";
import { buildRowIndex, toSnakeCase } from "../services/row-index.service";

const rowChargeSchema = z.object({
  id: z.string().optional(),
  chargeToken: z.string().optional(),
  label: z.string().min(1),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  formula: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const createRowSchema = z.object({
  label: z.string().default(""),
  rowToken: z
    .string()
    .min(1)
    .regex(
      /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/,
      "rowToken must be UPPER_SNAKE_CASE with no leading, trailing, or consecutive underscores",
    ),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
  charges: z.array(rowChargeSchema).optional().default([]),
});

export async function createRow(c: Context) {
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
      and(eq(templateSections.id, sectionId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);
  if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

  const templateId = secResult[0].section.templateId;

  const body = await c.req.json();
  const parsed = createRowSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const { rowToken, label, description, orderIndex, charges } = parsed.data;

  // Token uniqueness check
  const existingRow = await db.query.templateRows.findFirst({
    where: and(eq(templateRows.templateId, templateId), eq(templateRows.rowToken, rowToken)),
  });
  if (existingRow) {
    return c.json({ error: `rowToken "${rowToken}" is already used in this template.` }, 409);
  }

  // Create tokenToId map for encoding the formula
  const { tokenToId, idToToken } = await buildRowIndex(templateId);
  const { tokenToId: secTokenToId, idToToken: secIdToToken } = await buildSectionIndex(templateId);
  const { tplTokenToId, tplIdToToken } = await buildConstantIndex(templateId);

  // Assign sortOrder = max existing sortOrder + 1 so new rows always go to the bottom.
  const existingSortOrders = await db
    .select({ sortOrder: templateRows.sortOrder })
    .from(templateRows)
    .where(eq(templateRows.sectionId, sectionId));
  const maxSortOrder = existingSortOrders.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), -1);
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
        label,
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
            // Use explicit chargeToken if provided; fall back to label-derived token.
            chargeToken: charge.chargeToken ?? `${rowToken}_${toSnakeCase(charge.label)}`,
            formula:
              encodeFormula(charge.formula, tokenToId, secTokenToId, tplTokenToId) ??
              charge.formula,
            sortOrder: charge.sortOrder ?? i,
          })
          .returning()
          .then((r) => r[0]),
      ),
    );

    return {
      ...row,
      formula: decodeFormula(row.formula, idToToken, secIdToToken, tplIdToToken),
      charges: insertedCharges.map((ch) => ({
        ...ch,
        formula: decodeFormula(ch.formula, idToToken, secIdToToken, tplIdToToken) ?? ch.formula,
      })),
    };
  });

  return c.json(result, 201);
}
