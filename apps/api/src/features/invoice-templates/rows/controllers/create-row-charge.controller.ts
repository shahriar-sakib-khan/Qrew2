import { Context } from "hono";
import { db, templateRows, templateRowCharges, invoiceTemplates, encodeFormula, decodeFormula } from "@starter/db";
import { buildRowIndex, toSnakeCase } from "../services/row-index.service";
import { buildSectionIndex } from "../../sections/services/section-index.service";
import { buildConstantIndex } from "../../metadata/services/constant-index.service";
import { validateFormulaChars } from "../../validation/formula-validator";
import { validateTemplateDag } from "../../../invoices/engine/engine-utils";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

function validateFormula(formula: string | null | undefined): boolean {
  if (!formula || !formula.trim()) return false;
  if (/[+\-*/]\s*$/.test(formula.trim())) return false;
  if (/^\s*[+*/]/.test(formula.trim())) return false;
  return true;
}

const createRowChargeSchema = z.object({
  chargeToken: z
    .string()
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "chargeToken must be UPPER_SNAKE_CASE")
    .optional(),
  label: z.string().min(1),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  formula: z.string().min(1),
  orderIndex: z.number().int().min(0).default(0),
});

export async function createCharge(c: Context) {
  const rowId = c.req.param("rowId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const rowCheck = await db
    .select({ row: templateRows })
    .from(templateRows)
    .innerJoin(invoiceTemplates, eq(templateRows.templateId, invoiceTemplates.id))
    .where(and(eq(templateRows.id, rowId), eq(invoiceTemplates.organizationId, organizationId)))
    .limit(1);
  if (rowCheck.length === 0) return c.json({ error: "Row not found" }, 404);

  const body = await c.req.json();
  const parsed = createRowChargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const existingRow = rowCheck[0].row;
  const templateId = existingRow.templateId;

  const chargeToken =
    parsed.data.chargeToken ??
    `${existingRow.rowToken}_${toSnakeCase(parsed.data.label)}`;

  if (!validateFormula(parsed.data.formula)) {
    return c.json({ error: `Invalid formula syntax: "${parsed.data.formula}"` }, 422);
  }
  const charVal = validateFormulaChars(parsed.data.formula, chargeToken);
  if (!charVal.valid) {
    return c.json({ error: charVal.error }, 422);
  }

  const dup = await db.query.templateRowCharges.findFirst({
    where: and(
      eq(templateRowCharges.rowId, rowId),
      eq(templateRowCharges.chargeToken, chargeToken)
    ),
  });
  if (dup) {
    return c.json(
      { error: `Row charge token "${chargeToken}" already exists on this row.` },
      409
    );
  }

  const { tokenToId, idToToken } = await buildRowIndex(templateId);
  const { tokenToId: secTokenToId, idToToken: secIdToToken } = await buildSectionIndex(templateId);
  const { tplTokenToId, tplIdToToken } = await buildConstantIndex(templateId);

  try {
    const result = await db.transaction(async (tx) => {
      const [newCharge] = await tx
        .insert(templateRowCharges)
        .values({
          id: crypto.randomUUID(),
          rowId,
          label: parsed.data.label,
          subDescription: parsed.data.subDescription ?? null,
          qualifier: parsed.data.qualifier ?? null,
          tags: parsed.data.tags ?? [],
          chargeToken,
          formula: encodeFormula(parsed.data.formula, tokenToId, secTokenToId, tplTokenToId) ?? parsed.data.formula,
          sortOrder: parsed.data.orderIndex,
        })
        .returning();

      if (parsed.data.formula) {
        const validation = await validateTemplateDag(templateId, tx);
        if (!validation.valid) {
          throw new Error(`DAG_ERROR:${validation.errors[0].message}`);
        }
      }

      return {
        ...newCharge,
        formula: decodeFormula(newCharge.formula, idToToken, secIdToToken, tplIdToToken) ?? newCharge.formula,
      };
    });

    return c.json(result, 201);
  } catch (error: any) {
    if (error.message?.startsWith("DAG_ERROR:")) {
      return c.json({ error: error.message.replace("DAG_ERROR:", "") }, 422);
    }
    throw error;
  }
}
