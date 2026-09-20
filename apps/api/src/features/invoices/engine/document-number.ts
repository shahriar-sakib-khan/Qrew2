import { sql, eq, and, like } from "drizzle-orm";
import { invoicePdfLayouts, organizations, projects, invoiceTemplates, invoices } from "@starter/db";

export async function generateDocumentNumber(input: {
  organizationId: string;
  projectId: string;
  documentType: "pda" | "fda" | "proforma" | "general";
  sourceTemplateId?: string;
  tx: any; // Drizzle transaction object
}): Promise<string> {
  const { organizationId, projectId, documentType, sourceTemplateId, tx } = input;

  // ── 1. Lock the PDF layout row (FOR UPDATE NOWAIT) ──────────────────────
  // drizzle-orm/postgres-js: execute() returns the rows array directly (not {rows:[...]})
  const layoutRows = await tx.execute(
    sql`SELECT * FROM invoice_pdf_layouts WHERE organization_id = ${organizationId} FOR UPDATE NOWAIT`
  );

  // postgres-js driver returns an array directly; neon driver returns {rows:[...]}
  const rawLayoutRow = Array.isArray(layoutRows) ? layoutRows[0] : layoutRows?.rows?.[0];

  let layoutRow: any = rawLayoutRow;

  if (!layoutRow) {
    // No layout configured — use sensible defaults
    layoutRow = {
      pda_prefix: "PDA",
      fda_prefix: "FDA",
      proforma_prefix: "PRO",
      general_prefix: "INV",
      invoice_number_format: "{DOC_TYPE}-{FILE_SEQ}-{DOC_SEQ}",
      current_doc_sequence: 0,
    };
  }

  // ── 3. Resolve pattern variables using Drizzle typed queries ────────────
  const [orgRow] = await tx
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const orgSlug: string = orgRow?.slug || "ORG";

  const [projectRow] = await tx
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const projectName: string = projectRow?.name || "UnknownFile";

  let templateName = "Invoice";
  if (sourceTemplateId) {
    const [templateRow] = await tx
      .select({ name: invoiceTemplates.name })
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.id, sourceTemplateId))
      .limit(1);
    if (templateRow) templateName = templateRow.name;
  }

  // ── 4. Build the document number ─────────────────────────────────────────
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear().toString().slice(-2);

  // Format: <filename> - <template_name> - <month>/<last_two_digits_of_year>
  const baseDocumentNumber = `${projectName} - ${templateName} - ${month}/${year}`;

  const existingInvoices = await tx
    .select({ documentNumber: invoices.documentNumber })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        like(invoices.documentNumber, `${baseDocumentNumber}%`)
      )
    );

  let finalDocumentNumber = baseDocumentNumber;
  if (existingInvoices.length > 0) {
    let maxSuffix = 0;
    for (const inv of existingInvoices) {
      if (inv.documentNumber === baseDocumentNumber) {
        maxSuffix = Math.max(maxSuffix, 1);
      } else {
        const match = inv.documentNumber.match(/\((\d+)\)$/);
        if (match) {
          maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
        }
      }
    }
    if (maxSuffix > 0) {
      finalDocumentNumber = `${baseDocumentNumber} (${maxSuffix + 1})`;
    }
  }

  const documentNumber = finalDocumentNumber;

  // ── 5. Increment the sequence counter if a real layout row exists ────────
  if (layoutRow.id) {
    await tx.execute(
      sql`UPDATE invoice_pdf_layouts SET current_doc_sequence = current_doc_sequence + 1 WHERE id = ${layoutRow.id}`
    );
  }

  return documentNumber;
}
