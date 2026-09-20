// V2 Freeze Engine — persists pre-evaluated V2 sections from the engine preview.
// The frontend sends EvaluatedSection[] (already computed by AstEvaluatorService),
// so the freeze does NOT re-evaluate. It simply validates, writes, and locks.
import {
  db,
  invoices,
  invoiceLineItems,
  invoiceDrafts,
  invoiceReservedNumbers,
  templateHeaderFields,
  invoiceTemplates,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { generateDocumentNumber } from "./document-number";
import { resolveScope } from "./token-resolver.service";
import type { EvaluatedSection, EvaluatedRow } from "./types";

interface FreezeParams {
  organizationId: string;
  projectId: string;
  clientId: string;
  userId: string;
  documentType: "pda" | "fda" | "proforma" | "general";
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
  /** V2 EvaluatedSection[] from the frontend preview — already computed, no re-eval needed */
  draftRows: EvaluatedSection[];
  headerFieldValues: Record<string, string>;
  issuedToClientName: string;
  currency?: string;
  notes?: string;
}

/**
 * The Atomic Freeze Transaction (V2)
 *
 * Accepts pre-evaluated EvaluatedSection[] from the frontend.
 * Persists them to the DB atomically — no re-evaluation inside the transaction.
 * Any failure = full rollback. No partial state can persist.
 */
export async function freezeInvoice(params: FreezeParams) {
  return await db.transaction(async (tx) => {
    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Compute grand total from evaluated sections
    // ─────────────────────────────────────────────────────────────────────
    let totalBase = 0;
    let totalCharges = 0;

    for (const section of params.draftRows) {
      // Section base = sum of row baseValues
      totalBase += parseFloat(section.sectionBase ?? "0");
      // Section charges total
      totalCharges += parseFloat(section.sectionChargesTotal ?? "0");
      // Row charges are already summed into sectionTotal by the evaluator
      for (const row of section.rows ?? []) {
        totalCharges += parseFloat(row.chargesValue ?? "0");
      }
    }

    const grandTotal = (totalBase + totalCharges).toFixed(6);
    const totalBaseStr = totalBase.toFixed(6);
    const totalChargesStr = totalCharges.toFixed(6);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Insert invoice placeholder (status='draft')
    // ─────────────────────────────────────────────────────────────────────
    const [invoice] = await tx
      .insert(invoices)
      .values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        projectId: params.projectId,
        clientId: params.clientId,
        documentType: params.documentType,
        documentNumber: "PENDING",
        status: "draft",
        sourceTemplateId: params.sourceTemplateId ?? null,
        sourceTemplateVersion: params.sourceTemplateVersion ?? null,
        generatedByUserId: params.userId,
        issuedToClientName: params.issuedToClientName,
        currency: params.currency ?? "USD",
        totalBaseAmount: totalBaseStr,
        totalChargesAmount: totalChargesStr,  // ← correct column name
        grandTotalAmount: grandTotal,
        notes: params.notes ?? null,
        schemaVersion: "2.0",
      })
      .returning();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Generate document number (SELECT FOR UPDATE NOWAIT)
    // ─────────────────────────────────────────────────────────────────────
    const documentNumber = await generateDocumentNumber({
      organizationId: params.organizationId,
      projectId: params.projectId,
      documentType: params.documentType,
      sourceTemplateId: params.sourceTemplateId,
      tx,
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Re-resolve scope for historicalFormat (audit trail)
    // ─────────────────────────────────────────────────────────────────────
    const scope = await resolveScope({
      projectId: params.projectId,
      organizationId: params.organizationId,
      templateId: params.sourceTemplateId ?? "",
      db: tx,
      headerFieldValues: params.headerFieldValues,
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Write line items from V2 EvaluatedSection[] rows
    // ─────────────────────────────────────────────────────────────────────
    const lineItemInserts: any[] = [];
    let displayOrder = 0;

    for (const section of params.draftRows) {
      for (const row of section.rows ?? []) {
        lineItemInserts.push({
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          sectionToken: section.sectionToken ?? null,
          sectionDisplayName: section.displayName ?? null,
          rowToken: row.rowToken,
          lineType: "row",
          label: row.parentLabel,
          subDescription: null,
          qualifier: null,
          formulaSnapshot: null,
          componentsSnapshot: null,
          chargesSnapshot: row.charges?.length > 0 ? row.charges : null,
          baseValue: row.baseValue,
          chargesValue: row.chargesValue,
          totalValue: row.totalValue,
          computationCurrency: params.currency ?? "USD",
          isVisible: true,
          displayOrder: displayOrder++,
        });

        // Write row charges as sub-line items
        for (const charge of row.charges ?? []) {
          lineItemInserts.push({
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            sectionToken: section.sectionToken ?? null,
            sectionDisplayName: section.displayName ?? null,
            rowToken: charge.chargeToken,
            lineType: "row_charge",
            label: charge.label,
            subDescription: charge.subDescription ?? null,
            qualifier: charge.qualifier ?? null,
            formulaSnapshot: charge.formulaSnapshot ?? null,
            componentsSnapshot: null,
            chargesSnapshot: null,
            baseValue: "0.000000",
            chargesValue: charge.value,
            totalValue: charge.value,
            computationCurrency: params.currency ?? "USD",
            isVisible: true,
            displayOrder: displayOrder++,
          });
        }
      }

      // Write section charges as line items
      for (const sc of section.sectionCharges ?? []) {
        lineItemInserts.push({
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          sectionToken: section.sectionToken ?? null,
          sectionDisplayName: section.displayName ?? null,
          rowToken: sc.chargeToken,
          lineType: "section_charge",
          label: sc.label,
          subDescription: sc.subDescription ?? null,
          qualifier: sc.qualifier ?? null,
          formulaSnapshot: sc.formulaSnapshot ?? null,
          componentsSnapshot: null,
          chargesSnapshot: null,
          baseValue: "0.000000",
          chargesValue: sc.value,
          totalValue: sc.value,
          computationCurrency: params.currency ?? "USD",
          isVisible: true,
          displayOrder: displayOrder++,
        });
      }
    }

    if (lineItemInserts.length > 0) {
      await tx.insert(invoiceLineItems).values(lineItemInserts);
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 6: Fetch template name for historicalFormat
    // ─────────────────────────────────────────────────────────────────────
    let templateName = "Custom Invoice";
    if (params.sourceTemplateId) {
      const [tpl] = await tx
        .select({ name: invoiceTemplates.name })
        .from(invoiceTemplates)
        .where(eq(invoiceTemplates.id, params.sourceTemplateId))
        .limit(1);
      if (tpl) templateName = tpl.name;
    }

    const resolvedScope = {
      schemaVersion: "2.0",
      resolvedAt: new Date().toISOString(),
      projectId: params.projectId,
      tokens: scope,
    };

    // Snapshot the V2 evaluated sections as the historical format
    const historicalFormat = {
      schemaVersion: "2.0",
      templateId: params.sourceTemplateId ?? "custom",
      templateVersion: params.sourceTemplateVersion ?? 1,
      templateName,
      sections: params.draftRows,
    };

    // ─────────────────────────────────────────────────────────────────────
    // STEP 7: Atomic status change to 'frozen'
    // ─────────────────────────────────────────────────────────────────────
    const [frozen] = await tx
      .update(invoices)
      .set({
        status: "frozen",
        documentNumber,
        historicalFormat,
        resolvedScope,
        resolvedHeaderValues: params.headerFieldValues,
        totalBaseAmount: totalBaseStr,
        totalChargesAmount: totalChargesStr,  // ← correct column name
        grandTotalAmount: grandTotal,
        frozenAt: new Date(),
        schemaVersion: "2.0",
      })
      .where(eq(invoices.id, invoice.id))
      .returning();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 8: Mark reserved number as used
    // ─────────────────────────────────────────────────────────────────────
    await tx
      .update(invoiceReservedNumbers)
      .set({ isUsed: true, usedByInvoiceId: frozen.id })
      .where(
        and(
          eq(invoiceReservedNumbers.projectId, params.projectId),
          eq(invoiceReservedNumbers.documentType, params.documentType)
        )
      );

    // ─────────────────────────────────────────────────────────────────────
    // STEP 9: Delete the draft
    // ─────────────────────────────────────────────────────────────────────
    await tx
      .delete(invoiceDrafts)
      .where(
        and(
          eq(invoiceDrafts.projectId, params.projectId),
          eq(invoiceDrafts.userId, params.userId)
        )
      );

    return frozen;
    // ON ANY THROW: entire transaction rolls back. No partial state persists.
  });
}
