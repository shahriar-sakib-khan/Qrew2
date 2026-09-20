import { Context } from "hono";
import { db, invoiceTypes } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export class InvoiceTypesController {
  static async listTypes(c: Context) {
    try {
      const orgId = c.get("organizationId");
      if (!orgId) return c.json({ error: "Unauthorized" }, 401);

      const types = await db
        .select()
        .from(invoiceTypes)
        .where(eq(invoiceTypes.organizationId, orgId))
        .orderBy(invoiceTypes.createdAt);

      return c.json(types);
    } catch (err: any) {
      console.error("[InvoiceTypesController.listTypes]", err);
      return c.json({ error: "Failed to list invoice types" }, 500);
    }
  }

  static async createType(c: Context) {
    try {
      const orgId = c.get("organizationId");
      if (!orgId) return c.json({ error: "Unauthorized" }, 401);

      const body = await c.req.json() as any;
      const { name, isDefault } = body;

      if (!name) return c.json({ error: "Name is required" }, 400);

      if (isDefault) {
        await db
          .update(invoiceTypes)
          .set({ isDefault: false })
          .where(eq(invoiceTypes.organizationId, orgId));
      }

      const [newType] = await db
        .insert(invoiceTypes)
        .values({
          id: uuidv4(),
          organizationId: orgId,
          name,
          isDefault: !!isDefault,
        })
        .returning();

      return c.json(newType, 201);
    } catch (err: any) {
      console.error("[InvoiceTypesController.createType]", err);
      return c.json({ error: "Failed to create invoice type" }, 500);
    }
  }

  static async updateType(c: Context) {
    try {
      const orgId = c.get("organizationId");
      if (!orgId) return c.json({ error: "Unauthorized" }, 401);

      const typeId = c.req.param("id") as string;
      const body = await c.req.json() as any;
      const { name, isDefault } = body;

      if (isDefault) {
        await db
          .update(invoiceTypes)
          .set({ isDefault: false })
          .where(eq(invoiceTypes.organizationId, orgId));
      }

      const [updated] = await db
        .update(invoiceTypes)
        .set({ 
          ...(name && { name }), 
          ...(isDefault !== undefined && { isDefault }) 
        })
        .where(and(eq(invoiceTypes.id, typeId), eq(invoiceTypes.organizationId, orgId)))
        .returning();

      return c.json(updated);
    } catch (err: any) {
      console.error("[InvoiceTypesController.updateType]", err);
      return c.json({ error: "Failed to update invoice type" }, 500);
    }
  }

  static async deleteType(c: Context) {
    try {
      const orgId = c.get("organizationId");
      if (!orgId) return c.json({ error: "Unauthorized" }, 401);

      const typeId = c.req.param("id") as string;

      await db
        .delete(invoiceTypes)
        .where(and(eq(invoiceTypes.id, typeId), eq(invoiceTypes.organizationId, orgId)));

      return c.json({ success: true });
    } catch (err: any) {
      console.error("[InvoiceTypesController.deleteType]", err);
      return c.json({ error: "Failed to delete invoice type" }, 500);
    }
  }
}
