import { Context } from "hono";
import { db, templateHeaderFields } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createHeaderFieldSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum(["manual", "org_constant", "file_field"]),
  fileFieldKey: z.string().optional().nullable(),
  orgConfigKey: z.string().optional().nullable(),
  defaultManualValue: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  isFormulaInjectable: z.boolean().optional().default(true),
  columnPosition: z.enum(["left", "right"]).optional().default("left"),
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

    // Get max sort order for the column
    const existing = await db
      .select({ sortOrder: templateHeaderFields.sortOrder })
      .from(templateHeaderFields)
      .where(
        and(
          eq(templateHeaderFields.templateId, templateId),
          eq(templateHeaderFields.columnPosition, parsed.data.columnPosition)
        )
      );
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

  static async updateHeaderField(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const fieldId = c.req.param("fieldId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const updateHeaderFieldSchema = z.object({
      label: z.string().min(1).optional(),
      fieldType: z.enum(["manual", "org_constant", "file_field"]).optional(),
      fileFieldKey: z.string().optional().nullable(),
      orgConfigKey: z.string().optional().nullable(),
      defaultManualValue: z.string().optional().nullable(),
      placeholder: z.string().optional().nullable(),
      isFormulaInjectable: z.boolean().optional(),
      columnPosition: z.enum(["left", "right"]).optional(),
      sortOrder: z.number().optional(),
    });

    const body = await c.req.json();
    const parsed = updateHeaderFieldSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const [updated] = await db
      .update(templateHeaderFields)
      .set(parsed.data)
      .where(
        and(
          eq(templateHeaderFields.id, fieldId),
          eq(templateHeaderFields.templateId, templateId)
        )
      )
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);

    return c.json(updated);
  }

  static async reorderHeaderFields(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = z.object({
      updates: z.array(z.object({
        fieldId: z.string(),
        columnPosition: z.enum(["left", "right"]),
        sortOrder: z.number()
      }))
    }).safeParse(body);

    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const { updates } = parsed.data;

    await db.transaction(async (tx) => {
      await Promise.all(
        updates.map(u => 
          tx.update(templateHeaderFields)
            .set({ columnPosition: u.columnPosition, sortOrder: u.sortOrder })
            .where(
              and(
                eq(templateHeaderFields.id, u.fieldId),
                eq(templateHeaderFields.templateId, templateId)
              )
            )
        )
      );
    });

    return c.json({ success: true });
  }
}
