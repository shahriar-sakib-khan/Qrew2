import { Context } from "hono";
import { db, templateConstants } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createConstantSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/),
  valueType: z.enum(["number", "percentage", "currency_rate", "text"]),
  value: z.string().optional().default(""),
  description: z.string().optional(),
});

const updateConstantSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/).optional(),
  valueType: z.enum(["number", "percentage", "currency_rate", "text"]).optional(),
  value: z.string().optional(),
  description: z.string().optional(),
});

export class TemplateConstantsController {
  static async listConstants(c: Context) {
    const templateId = c.req.param("templateId") as string;
    
    const constants = await db
      .select()
      .from(templateConstants)
      .where(eq(templateConstants.templateId, templateId));

    return c.json(constants);
  }

  static async createConstant(c: Context) {
    const templateId = c.req.param("templateId") as string;
    
    const body = await c.req.json();
    const parsed = createConstantSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const [newConstant] = await db
      .insert(templateConstants)
      .values({
        id: crypto.randomUUID(),
        templateId,
        token: parsed.data.key,
        valueType: parsed.data.valueType,
        defaultValue: parsed.data.value,
        name: parsed.data.description || parsed.data.key,
      })
      .returning();

    return c.json(newConstant, 201);
  }

  static async updateConstant(c: Context) {
    const id = c.req.param("constantId") as string;
    
    const body = await c.req.json();
    const parsed = updateConstantSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const updateData: any = {};
    if (parsed.data.key !== undefined) updateData.token = parsed.data.key;
    if (parsed.data.valueType !== undefined) updateData.valueType = parsed.data.valueType;
    if (parsed.data.value !== undefined) updateData.defaultValue = parsed.data.value;
    if (parsed.data.description !== undefined) updateData.name = parsed.data.description;

    const [updated] = await db
      .update(templateConstants)
      .set(updateData)
      .where(eq(templateConstants.id, id))
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);

    return c.json(updated);
  }

  static async deleteConstant(c: Context) {
    const id = c.req.param("constantId") as string;
    
    const [deleted] = await db
      .delete(templateConstants)
      .where(eq(templateConstants.id, id))
      .returning();

    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  }
}
