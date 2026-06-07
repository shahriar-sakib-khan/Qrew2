import { Context } from "hono";
import { db, invoices, invoiceLineItems } from "@starter/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export class InvoicesController {
  static async listInvoices(c: Context) {
    try {
      const user = c.get("user");
      const orgId = user?.organizationId;
      if (!orgId) return c.json({ error: "Organization context required" }, 401);

      const allInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.organizationId, orgId))
        .orderBy(desc(invoices.createdAt));

      return c.json(allInvoices);
    } catch (err: any) {
      console.error(err);
      return c.json({ error: "Failed to list invoices" }, 500);
    }
  }

  static async getInvoice(c: Context) {
    try {
      const id = c.req.param("id");
      if (!id) return c.json({ error: "Invoice ID required" }, 400);
      const user = c.get("user");
      const orgId = user?.organizationId;
      if (!orgId) return c.json({ error: "Organization context required" }, 401);

      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.organizationId, orgId)),
      });

      if (!invoice) return c.json({ error: "Invoice not found" }, 404);

      const lines = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, id));

      return c.json({ invoice, lineItems: lines });
    } catch (err: any) {
      console.error(err);
      return c.json({ error: "Failed to get invoice" }, 500);
    }
  }

  static async createInvoice(c: Context) {
    try {
      const user = c.get("user");
      const orgId = user?.organizationId;
      if (!orgId) return c.json({ error: "Organization context required" }, 401);

      const bodySchema = z.object({
        clientId: z.string().optional().nullable(),
        projectId: z.string().optional().nullable(),
        invoiceNumber: z.string(),
        issueDate: z.string().optional(),
        dueDate: z.string().optional(),
        subtotal: z.number(),
        taxAmount: z.number(),
        totalAmount: z.number(),
        notes: z.string().optional(),
        lineItems: z.array(
          z.object({
            description: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            amount: z.number(),
            expenseId: z.string().optional().nullable(),
          })
        ),
      });

      const body = await c.req.json();
      const parsed = bodySchema.parse(body);

      const newInvoiceId = uuidv4();
      await db.insert(invoices).values({
        id: newInvoiceId,
        organizationId: orgId,
        clientId: parsed.clientId || null,
        projectId: parsed.projectId || null,
        invoiceNumber: parsed.invoiceNumber,
        issueDate: parsed.issueDate ? new Date(parsed.issueDate) : undefined,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        subtotal: parsed.subtotal.toString(),
        taxAmount: parsed.taxAmount.toString(),
        totalAmount: parsed.totalAmount.toString(),
        notes: parsed.notes,
      });

      if (parsed.lineItems.length > 0) {
        const linesToInsert = parsed.lineItems.map((li: any) => ({
          id: uuidv4(),
          invoiceId: newInvoiceId,
          expenseId: li.expenseId || null,
          description: li.description,
          quantity: li.quantity.toString(),
          unitPrice: li.unitPrice.toString(),
          amount: li.amount.toString(),
        }));
        await db.insert(invoiceLineItems).values(linesToInsert);
      }

      return c.json({ success: true, invoiceId: newInvoiceId }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ error: "Failed to create invoice", details: err.message }, 400);
    }
  }

  static async updateStatus(c: Context) {
    try {
      const id = c.req.param("id");
      if (!id) return c.json({ error: "Invoice ID required" }, 400);
      const { status } = await c.req.json();
      const user = c.get("user");
      const orgId = user?.organizationId;
      if (!orgId) return c.json({ error: "Organization context required" }, 401);

      const validStatuses = ["draft", "open", "paid", "void", "uncollectible"];
      if (!validStatuses.includes(status)) {
        return c.json({ error: "Invalid status" }, 400);
      }

      await db
        .update(invoices)
        .set({ status })
        .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)));

      return c.json({ success: true });
    } catch (err: any) {
      console.error(err);
      return c.json({ error: "Failed to update status" }, 500);
    }
  }
}
