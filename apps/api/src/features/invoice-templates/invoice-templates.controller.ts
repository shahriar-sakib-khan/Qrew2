import { Context } from "hono";
import { db, invoiceTemplates } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export class InvoiceTemplatesController {
  static async listTemplates(c: Context) {
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const templates = await db
      .select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.organizationId, organizationId));

    return c.json(templates);
  }

  static async getTemplate(c: Context) {
    const id = c.req.param("id") as string;
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const template = await db
      .select()
      .from(invoiceTemplates)
      .where(
        and(
          eq(invoiceTemplates.id, id),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);

    if (template.length === 0) return c.json({ error: "Not found" }, 404);

    return c.json(template[0]);
  }

  static async createTemplate(c: Context) {
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const [newTemplate] = await db
      .insert(invoiceTemplates)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description,
        createdByUserId: user.id,
      })
      .returning();

    return c.json(newTemplate, 201);
  }

  static async updateTemplate(c: Context) {
    const id = c.req.param("id") as string;
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const [updated] = await db
      .update(invoiceTemplates)
      .set(parsed.data)
      .where(
        and(
          eq(invoiceTemplates.id, id),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);

    return c.json(updated);
  }

  static async deleteTemplate(c: Context) {
    const id = c.req.param("id") as string;
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const [deleted] = await db
      .delete(invoiceTemplates)
      .where(
        and(
          eq(invoiceTemplates.id, id),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .returning();

    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  }
}
