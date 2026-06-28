import { Context } from "hono";
import { db, invoices, invoiceLineItems, expenseCategories, organizationConfigs, templateHeaderFields, templateSections, templateRows } from "@starter/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { freezeInvoice } from "./engine/invoice-freeze";

const generateSchema = z.object({
  projectId: z.string(),
  clientId: z.string(),
  documentType: z.enum(["pda", "fda", "proforma", "general"]),
  sourceTemplateId: z.string().optional(),
  sourceTemplateVersion: z.number().optional(),
  draftRows: z.array(z.any()).default([]),
  headerFieldValues: z.record(z.string(), z.string()).default({}),
  issuedToClientName: z.string(),
  currency: z.string().default("USD"),
  notes: z.string().optional()
});

export class InvoicesController {
  static async getTokens(c: Context) {
    try {
      const orgId = c.get("organizationId");
      if (!orgId) return c.json({ error: "Organization context required" }, 401);

      const templateId = c.req.query("templateId");
      
      const [categoriesData, orgConfigsData] = await Promise.all([
        db.select().from(expenseCategories).where(eq(expenseCategories.organizationId, orgId)),
        db.select().from(organizationConfigs).where(
          and(
            eq(organizationConfigs.organizationId, orgId),
            eq(organizationConfigs.isFormulaInjectable, true)
          )
        )
      ]);

      const categories = categoriesData.map(cat => ({
        tokenKey: cat.tokenKey,
        displayName: cat.name,
        token: `CAT_${cat.tokenKey}`
      }));

      const orgConfigs = orgConfigsData.map(conf => ({
        configKey: conf.configKey,
        displayLabel: conf.displayLabel,
        token: `ORG_${conf.configKey}`
      }));

      let fileFields: any[] = [];
      let sections: any[] = [];
      let rows: any[] = [];

      if (templateId) {
        const [fieldsData, sectionsData, rowsData] = await Promise.all([
          db.select().from(templateHeaderFields).where(
            and(
              eq(templateHeaderFields.templateId, templateId),
              eq(templateHeaderFields.fieldType, "file_field"),
              eq(templateHeaderFields.isFormulaInjectable, true)
            )
          ),
          db.select().from(templateSections).where(eq(templateSections.templateId, templateId)),
          db.select().from(templateRows).where(eq(templateRows.templateId, templateId))
        ]);

        fileFields = fieldsData.map(f => ({
          fieldKey: f.fileFieldKey,
          displayLabel: f.label,
          token: `FILE_${f.fileFieldKey}`
        }));

        sections = sectionsData.map(s => ({
          sectionToken: s.sectionToken,
          name: s.displayName ?? s.sectionToken,
          token: `SECTION_${s.sectionToken}`
        }));

        rows = rowsData.map(r => ({
          rowToken: r.rowToken,
          label: r.parentLabel,
          token: `ROW_${r.rowToken}`
        }));
      }

      return c.json({
        categories,
        orgConfigs,
        fileFields,
        ...(templateId ? { sections, rows } : {})
      });
    } catch (err: any) {
      console.error(err);
      return c.json({ error: "Failed to discover tokens" }, 500);
    }
  }

  static async listInvoices(c: Context) {
    try {
      const orgId = c.get("organizationId");
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
      const orgId = c.get("organizationId");
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

  static async generateInvoice(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const userId = c.get("userId");
      const body = await c.req.json();
      const parsed = generateSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Invalid payload", details: parsed.error.format() }, 400);
      }

      const frozenInvoice = await freezeInvoice({
        organizationId,
        userId,
        ...parsed.data
      });

      return c.json({
        invoiceId: frozenInvoice.id,
        documentNumber: frozenInvoice.documentNumber,
        status: frozenInvoice.status
      });
    } catch (err: any) {
      console.error("[InvoicesController.generateInvoice]", err);
      if (err.message === "INVOICE_GENERATION_IN_PROGRESS") {
        return c.json({ error: "Invoice generation is already in progress for this project." }, 409);
      }
      return c.json({ error: err.message || "Failed to generate invoice" }, 500);
    }
  }

  static async issueInvoice(c: Context) {
    try {
      const id = c.req.param("id");
      const organizationId = c.get("organizationId");

      const [invoice] = await db.update(invoices)
        .set({ status: "issued", issuedAt: new Date() })
        .where(and(eq(invoices.id, id!), eq(invoices.organizationId, organizationId!), eq(invoices.status, "frozen")))
        .returning();

      if (!invoice) return c.json({ error: "Invoice not found or not in frozen state" }, 404);

      return c.json(invoice);
    } catch (err: any) {
      console.error("[InvoicesController.issueInvoice]", err);
      return c.json({ error: "Failed to issue invoice" }, 500);
    }
  }

  static async voidInvoice(c: Context) {
    try {
      const id = c.req.param("id");
      const organizationId = c.get("organizationId");
      const body = await c.req.json();

      const [invoice] = await db.update(invoices)
        .set({ status: "void", voidedAt: new Date(), voidReason: body.voidReason || null })
        .where(and(eq(invoices.id, id!), eq(invoices.organizationId, organizationId!)))
        .returning();

      if (!invoice) return c.json({ error: "Invoice not found" }, 404);

      return c.json(invoice);
    } catch (err: any) {
      console.error("[InvoicesController.voidInvoice]", err);
      return c.json({ error: "Failed to void invoice" }, 500);
    }
  }
}
