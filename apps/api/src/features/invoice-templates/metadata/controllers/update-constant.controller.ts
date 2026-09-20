import { Context } from "hono";
import { db, templateConstants, templateRows, templateSectionCharges, templateSections, encodeFormula } from "@starter/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateConstantSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/).optional(),
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
      
      const rowTokensList = await tx.select({ id: templateRows.id, rowToken: templateRows.rowToken }).from(templateRows).where(eq(templateRows.templateId, templateId));
      const rowTokenToId: Record<string, string> = {};
      for (const r of rowTokensList) rowTokenToId[r.rowToken] = r.id;

      const secTokensList = await tx.select({ id: templateSections.id, sectionToken: templateSections.sectionToken }).from(templateSections).where(eq(templateSections.templateId, templateId));
      const secTokenToId: Record<string, string> = {};
      for (const s of secTokensList) {
        if (s.sectionToken) secTokenToId[`SEC_${s.sectionToken}`] = s.id;
      }

      const constTokensList = await tx.select({ id: templateConstants.id, token: templateConstants.token }).from(templateConstants).where(eq(templateConstants.templateId, templateId));
      const tplTokenToId: Record<string, string> = {};
      for (const c of constTokensList) {
        if (c.token) tplTokenToId[c.token] = c.id;
      }

      const rowsList = await tx.select({ id: templateRows.id, formula: templateRows.formula }).from(templateRows).where(eq(templateRows.templateId, templateId));
      for (const r of rowsList) {
        if (r.formula) {
          await tx.update(templateRows).set({ formula: encodeFormula(r.formula, rowTokenToId, secTokenToId, tplTokenToId) }).where(eq(templateRows.id, r.id));
        }
      }

      const secChargesList = await tx
        .select({ id: templateSectionCharges.id, formula: templateSectionCharges.formula })
        .from(templateSectionCharges)
        .innerJoin(templateSections, eq(templateSectionCharges.sectionId, templateSections.id))
        .where(eq(templateSections.templateId, templateId));
      for (const c of secChargesList) {
        if (c.formula) {
          const encoded = encodeFormula(c.formula, rowTokenToId, secTokenToId, tplTokenToId) ?? c.formula;
          await tx.update(templateSectionCharges).set({ formula: encoded }).where(eq(templateSectionCharges.id, c.id));
        }
      }
    }
  });

  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json(updated);
}
