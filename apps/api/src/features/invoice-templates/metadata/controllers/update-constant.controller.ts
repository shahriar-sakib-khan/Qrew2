import {
  db,
  templateConstants,
  templateRows,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { eq } from "drizzle-orm";
import { Context } from "hono";
import { z } from "zod";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";

const updateConstantSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/)
    .optional(),
  valueType: z.enum(["number", "percentage", "currency_rate", "text"]).optional(),
  value: z.string().optional(),
  description: z.string().optional(),
});

export async function updateConstant(c: Context) {
  const id = c.req.param("constantId") as string;

  const body = await c.req.json();
  const parsed = updateConstantSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const updateData: any = {};
  if (parsed.data.key !== undefined) updateData.token = parsed.data.key;
  if (parsed.data.valueType !== undefined) updateData.valueType = parsed.data.valueType;
  if (parsed.data.value !== undefined) updateData.defaultValue = parsed.data.value;
  if (parsed.data.description !== undefined) updateData.name = parsed.data.description;

  let updated;
  await db.transaction(async (tx) => {
    [updated] = await tx
      .update(templateConstants)
      .set(updateData)
      .where(eq(templateConstants.id, id))
      .returning();

    if (updated && updateData.token) {
      const templateId = updated.templateId;
      const context = await getTemplateFormulaContext(templateId, undefined, tx);

      const rowsList = await tx
        .select({ id: templateRows.id, formula: templateRows.formula })
        .from(templateRows)
        .where(eq(templateRows.templateId, templateId));
      for (const r of rowsList) {
        if (r.formula) {
          await tx
            .update(templateRows)
            .set({ formula: context.encode(r.formula) })
            .where(eq(templateRows.id, r.id));
        }
      }

      const secChargesList = await tx
        .select({ id: templateSectionCharges.id, formula: templateSectionCharges.formula })
        .from(templateSectionCharges)
        .innerJoin(templateSections, eq(templateSectionCharges.sectionId, templateSections.id))
        .where(eq(templateSections.templateId, templateId));
      for (const c of secChargesList) {
        if (c.formula) {
          const encoded = context.encode(c.formula) ?? c.formula;
          await tx
            .update(templateSectionCharges)
            .set({ formula: encoded })
            .where(eq(templateSectionCharges.id, c.id));
        }
      }
    }
  });

  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json(updated);
}
