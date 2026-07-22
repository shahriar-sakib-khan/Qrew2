import { Context } from "hono";
import { db, invoiceTemplates, templateHeaderFields, invoiceTypes, templateSections } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  documentType: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  documentType: z.string().optional(),
});

export class InvoiceTemplatesController {
  static async listTemplates(c: Context) {
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const templates = await db
      .select({
        id: invoiceTemplates.id,
        organizationId: invoiceTemplates.organizationId,
        name: invoiceTemplates.name,
        description: invoiceTemplates.description,
        documentType: invoiceTemplates.documentType,
        documentTypeName: invoiceTypes.name,
        scope: invoiceTemplates.scope,
        currency: invoiceTemplates.currency,
        version: invoiceTemplates.version,
        isArchived: invoiceTemplates.isArchived,
        createdAt: invoiceTemplates.createdAt,
        updatedAt: invoiceTemplates.updatedAt,
      })
      .from(invoiceTemplates)
      .leftJoin(invoiceTypes, eq(invoiceTemplates.documentType, invoiceTypes.id))
      .where(eq(invoiceTemplates.organizationId, organizationId));

    return c.json(templates);
  }

  static async getTemplate(c: Context) {
    const id = c.req.param("id") as string;
    const user = c.get("user");
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const template = await db
      .select({
        id: invoiceTemplates.id,
        organizationId: invoiceTemplates.organizationId,
        name: invoiceTemplates.name,
        description: invoiceTemplates.description,
        documentType: invoiceTemplates.documentType,
        documentTypeName: invoiceTypes.name,
        scope: invoiceTemplates.scope,
        currency: invoiceTemplates.currency,
        version: invoiceTemplates.version,
        isArchived: invoiceTemplates.isArchived,
        createdAt: invoiceTemplates.createdAt,
        updatedAt: invoiceTemplates.updatedAt,
      })
      .from(invoiceTemplates)
      .leftJoin(invoiceTypes, eq(invoiceTemplates.documentType, invoiceTypes.id))
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

    const templateId = crypto.randomUUID();

    const [newTemplate] = await db
      .insert(invoiceTemplates)
      .values({
        id: templateId,
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description,
        documentType: parsed.data.documentType,
        createdByUserId: user.id,
      })
      .returning();

    // Seed default system fields for the template header
    const systemFields = [
      { fieldType: "file_field" as const, fileFieldKey: "name", label: "Name", sortOrder: 1, isFormulaInjectable: false },
      { fieldType: "file_field" as const, fileFieldKey: "clientId", label: "Client", sortOrder: 2, isFormulaInjectable: false },
      { fieldType: "file_field" as const, fileFieldKey: "status", label: "Status", sortOrder: 3, isFormulaInjectable: false },
    ];

    // Fetch existing global project custom fields
    const { customFieldDefinitions } = await import("@starter/db");
    const projectFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, organizationId),
          eq(customFieldDefinitions.entityType, "project")
        )
      );

    const customFieldsToSeed = projectFields.map((field, idx) => ({
      fieldType: "file_field" as const,
      fileFieldKey: field.fieldKey,
      label: field.fieldName,
      sortOrder: systemFields.length + 1 + idx,
      isFormulaInjectable: field.fieldType === "number",
    }));

    const allHeaderFields = [...systemFields, ...customFieldsToSeed].map((f) => ({
      id: crypto.randomUUID(),
      templateId,
      ...f,
    }));

    if (allHeaderFields.length > 0) {
      await db.insert(templateHeaderFields).values(allHeaderFields);
    }

    // Seed default section 1
    await db.insert(templateSections).values({
      id: crypto.randomUUID(),
      templateId,
      sectionToken: "SECTION_1",
      displayName: "1",
      sortOrder: 0,
    });

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
