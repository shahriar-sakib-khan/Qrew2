import {
  db,
  decodeFormula,
  encodeFormula,
  invoiceTemplates,
  templateRowCharges,
  templateRows,
} from "@starter/db";
import { and, asc, eq } from "drizzle-orm";
import { Context } from "hono";
import { z } from "zod";
import { validateTemplateDag } from "../../../invoices/engine/engine-utils";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";
import { validateFormulaChars } from "../../validation/formula-validator";

const updateRowSchema = z.object({
  label: z.string().optional(),
  rowToken: z
    .string()
    .min(1)
    .regex(
      /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/,
      "rowToken must be UPPER_SNAKE_CASE with no leading, trailing, or consecutive underscores",
    )
    .optional(),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
  valueType: z.enum(["normal", "formula"]).optional(),
  formula: z.string().optional().nullable(),
  initialValue: z.number().optional().nullable(),
});

export async function updateRow(c: Context): Promise<any> {
  const rowId = c.req.param("rowId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

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

  if (parsed.data.rowToken && parsed.data.rowToken !== existingRow.rowToken) {
    const dup = await db.query.templateRows.findFirst({
      where: and(
        eq(templateRows.templateId, existingRow.templateId),
        eq(templateRows.rowToken, parsed.data.rowToken),
      ),
    });
    if (dup) {
      return c.json(
        { error: `rowToken "${parsed.data.rowToken}" is already used in this template.` },
        409,
      );
    }
  }

  const context = await getTemplateFormulaContext(existingRow.templateId, organizationId);
  const tokenToId = { ...context.rowTokenToId };
  const idToToken = { ...context.rowIdToToken };

  if (parsed.data.rowToken && parsed.data.rowToken !== existingRow.rowToken) {
    delete tokenToId[existingRow.rowToken];
    tokenToId[newRowToken] = rowId;
    idToToken[rowId] = newRowToken;
  }

  const updateFields: any = {};
  if (parsed.data.label !== undefined) updateFields.label = parsed.data.label;
  if (parsed.data.rowToken !== undefined) updateFields.rowToken = parsed.data.rowToken;
  if (parsed.data.description !== undefined) updateFields.description = parsed.data.description;
  if (parsed.data.orderIndex !== undefined) updateFields.sortOrder = parsed.data.orderIndex;
  if (parsed.data.valueType !== undefined) updateFields.valueType = parsed.data.valueType;
  if (parsed.data.formula !== undefined) {
    const formulaToSave = parsed.data.formula?.trim() ?? null;
    if (formulaToSave) {
      const charValidation = validateFormulaChars(formulaToSave, newRowToken);
      if (!charValidation.valid) {
        return c.json({ error: charValidation.error }, 422);
      }
    }
    updateFields.formula =
      parsed.data.valueType === "formula" || formulaToSave
        ? encodeFormula(
            formulaToSave,
            tokenToId,
            context.secTokenToId,
            context.tplTokenToId,
            context.fileFieldTokens,
            context.globalTokens,
          )
        : null;
    if (formulaToSave) updateFields.initialValue = null;
  }
  if (parsed.data.initialValue !== undefined) {
    updateFields.initialValue =
      parsed.data.initialValue != null ? String(parsed.data.initialValue) : null;
    if (parsed.data.initialValue != null) updateFields.formula = null;
  }

  if (Object.keys(updateFields).length === 0) {
    return c.json({ error: "No values to set" }, 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [updatedRow] = await tx
        .update(templateRows)
        .set(updateFields)
        .where(eq(templateRows.id, rowId))
        .returning();

      if (updateFields.formula !== undefined || updateFields.rowToken !== undefined) {
        const validation = await validateTemplateDag(existingRow.templateId, tx);
        if (!validation.valid) {
          throw new Error(`DAG_ERROR:${validation.errors[0].message}`);
        }
      }

      const charges = await tx.query.templateRowCharges.findMany({
        where: eq(templateRowCharges.rowId, rowId),
        orderBy: [asc(templateRowCharges.sortOrder)],
      });

      return {
        ...updatedRow,
        formula: decodeFormula(
          updatedRow.formula,
          idToToken,
          context.secIdToToken,
          context.tplIdToToken,
          context.fileFieldTokens,
          context.globalTokens,
        ),
        charges: charges.map((ch) => ({
          ...ch,
          formula:
            decodeFormula(
              ch.formula,
              idToToken,
              context.secIdToToken,
              context.tplIdToToken,
              context.fileFieldTokens,
              context.globalTokens,
            ) ?? ch.formula,
        })),
      };
    });

    return c.json(result);
  } catch (error: any) {
    if (error.message?.startsWith("DAG_ERROR:")) {
      return c.json({ error: error.message.replace("DAG_ERROR:", "") }, 422);
    }
    throw error;
  }
}
