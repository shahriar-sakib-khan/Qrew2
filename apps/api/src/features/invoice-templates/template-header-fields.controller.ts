import { Context } from "hono";
import { db, templateHeaderFields } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createHeaderFieldSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum(["manual", "org_config", "file_field"]),
  fileFieldKey: z.string().optional().nullable(),
  orgConfigKey: z.string().optional().nullable(),
  defaultManualValue: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  isFormulaInjectable: z.boolean().optional().default(true),
});

export class TemplateHeaderFieldsController {
  static async listHeaderFields(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const fields = await db
      .select()
      .from(templateHeaderFields)
      .where(eq(templateHeaderFields.templateId, templateId))
      .orderBy(templateHeaderFields.sortOrder);

    return c.json(fields);
  }

  static async createHeaderField(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = createHeaderFieldSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    // Get max sort order
    const existing = await db
      .select({ sortOrder: templateHeaderFields.sortOrder })
      .from(templateHeaderFields)
      .where(eq(templateHeaderFields.templateId, templateId));
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(f => f.sortOrder)) + 1 : 0;

    const [newField] = await db
      .insert(templateHeaderFields)
      .values({
        id: crypto.randomUUID(),
        templateId,
        ...parsed.data,
        sortOrder: nextOrder,
      })
      .returning();

    return c.json(newField, 201);
  }

  static async deleteHeaderField(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const fieldId = c.req.param("fieldId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const [deleted] = await db
      .delete(templateHeaderFields)
      .where(
        and(
          eq(templateHeaderFields.id, fieldId),
          eq(templateHeaderFields.templateId, templateId)
        )
      )
      .returning();

    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json(deleted);
  }

  static async reorderHeaderFields(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const fieldIds: string[] = body.fieldIds;
    if (!Array.isArray(fieldIds)) {
      return c.json({ error: "fieldIds must be an array" }, 400);
    }

    // In a real app, do this in a transaction or a bulk update
    for (let i = 0; i < fieldIds.length; i++) {
      await db
        .update(templateHeaderFields)
        .set({ sortOrder: i })
        .where(
          and(
            eq(templateHeaderFields.id, fieldIds[i]),
            eq(templateHeaderFields.templateId, templateId)
          )
        );
    }

    return c.json({ success: true });
  }
}
