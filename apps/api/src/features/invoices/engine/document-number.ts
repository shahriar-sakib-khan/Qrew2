import { sql, eq } from "drizzle-orm";
import { invoicePdfLayouts, organizations, projects } from "@starter/db";

export async function generateDocumentNumber(input: {
  organizationId: string;
  projectId: string;
  documentType: "pda" | "fda" | "proforma" | "general";
  tx: any; // Drizzle transaction object
}): Promise<string> {
  const { organizationId, projectId, documentType, tx } = input;

  // 1. Lock the layout row
  // In Drizzle, we can use sql`... FOR UPDATE NOWAIT` but Drizzle's query builder might not natively support NOWAIT easily without dropping to raw SQL or extensions, but we can do it via raw SQL if needed, or simply standard FOR UPDATE.
  // We'll use a raw query or a standard select with lock if supported. Let's use raw SQL for the NOWAIT guarantee.
  
  const layoutQuery = await tx.execute(
    sql`SELECT * FROM invoice_pdf_layouts WHERE organization_id = ${organizationId} FOR UPDATE NOWAIT`
  );

  let layoutRow = layoutQuery.rows[0] as any;
  
  if (!layoutRow) {
    // If no layout exists, we should probably fall back to a default format or create one, but spec assumes it exists or we use defaults.
    layoutRow = {
      pda_prefix: "PDA",
      fda_prefix: "FDA",
      proforma_prefix: "PRO",
      general_prefix: "INV",
      invoice_number_format: "{DOC_TYPE}-{FILE_SEQ}",
      current_doc_sequence: 0
    };
  }

  // 2. Read the format pattern
  const formatPattern = layoutRow.invoice_number_format;

  // 3. Resolve each pattern variable
  // We need organization slug and project fileSequenceNumber
  const orgQuery = await tx.execute(
    sql`SELECT slug FROM organizations WHERE id = ${organizationId}`
  );
  const orgSlug = orgQuery.rows[0]?.slug || "ORG";

  const projectQuery = await tx.execute(
    sql`SELECT file_sequence_number FROM projects WHERE id = ${projectId}`
  );
  const fileSeq = projectQuery.rows[0]?.file_sequence_number || 0;

  const docTypePrefixMap: Record<string, string> = {
    pda: layoutRow.pda_prefix || "PDA",
    fda: layoutRow.fda_prefix || "FDA",
    proforma: layoutRow.proforma_prefix || "PRO",
    general: layoutRow.general_prefix || "INV",
  };

  const docType = docTypePrefixMap[documentType] || "INV";
  const fileSeqStr = fileSeq.toString().padStart(3, "0");
  const docSeq = (Number(layoutRow.current_doc_sequence || 0) + 1).toString().padStart(3, "0");
  
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const monthYear = `${month}-${year.slice(-2)}`;

  let documentNumber = formatPattern
    .replace(/\{ORG_CODE\}/g, orgSlug)
    .replace(/\{DOC_TYPE\}/g, docType)
    .replace(/\{FILE_SEQ\}/g, fileSeqStr)
    .replace(/\{DOC_SEQ\}/g, docSeq)
    .replace(/\{YEAR\}/g, year)
    .replace(/\{MONTH\}/g, month)
    .replace(/\{MONTH_YEAR\}/g, monthYear);

  // 4. Increment sequence if we had a row
  if (layoutRow.id) {
    await tx.execute(
      sql`UPDATE invoice_pdf_layouts SET current_doc_sequence = current_doc_sequence + 1 WHERE id = ${layoutRow.id}`
    );
  }

  return documentNumber;
}
