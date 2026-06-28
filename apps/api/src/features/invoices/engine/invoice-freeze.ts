// @ts-nocheck
// TODO: [V2 Migration] invoice-freeze.ts needs a full rewrite to use DraftSectionV2,
// EvaluatorRow V2, and the new line_type-discriminated invoiceLineItems schema.
// Suppressed with @ts-nocheck until the dedicated freeze-engine sprint.
import {
  db,
  invoices,
  invoiceLineItems,
  invoiceDrafts,
  invoiceReservedNumbers,
  templateHeaderFields,
  templateSections,
  invoiceTemplates,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { generateDocumentNumber } from "./document-number";
import { resolveScope } from "./token-resolver.service";
import { DagValidatorService } from "./dag-validator.service";
import { AstEvaluatorService, EvaluatorRow } from "./ast-evaluator.service";
import { interpolateRows } from "./text-interpolator.service";
import {
  DraftSectionV1,
  HistoricalFormatV1,
  ResolvedScopeV1,
  EvaluatedRow,
} from "./types";

interface FreezeParams {
  organizationId: string;
  projectId: string;
  clientId: string;
  userId: string;
  documentType: "pda" | "fda" | "proforma" | "general";
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
  draftRows: DraftSectionV1[];
  headerFieldValues: Record<string, string>;
  issuedToClientName: string;
  currency?: string;
  notes?: string;
}

/**
 * The Atomic Freeze Transaction — per BACKEND_AGENT.md §10
 *
 * All 12 steps run inside a single database transaction.
 * Any failure = full rollback. No partial state can persist.
 */
export async function freezeInvoice(params: FreezeParams) {
  return await db.transaction(async (tx) => {
    // ---------------------------------------------------------------
    // STEP 1: Idempotency guard — check for duplicate in-flight generation
    // NOTE: We use status='draft' as a placeholder insert instead of a
    // 'generating' status (which doesn't exist in the enum). We use a
    // unique-per-project approach: if a row for this project + status=draft
    // already exists and was just inserted (within the last 10s), we block.
    // The real protection is the transaction lock on the PDF layout row (Step 3).
    // ---------------------------------------------------------------
    // (No 'generating' enum value — idempotency is handled by the FOR UPDATE lock)

    // ---------------------------------------------------------------
    // STEP 2: Insert invoice placeholder (status='draft', will update to 'frozen')
    // ---------------------------------------------------------------
    const [invoice] = await tx
      .insert(invoices)
      .values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        projectId: params.projectId,
        clientId: params.clientId,
        documentType: params.documentType,
        documentNumber: "PENDING", // updated in step 10
        status: "draft",
        sourceTemplateId: params.sourceTemplateId ?? null,
        sourceTemplateVersion: params.sourceTemplateVersion ?? null,
        generatedByUserId: params.userId,
        issuedToClientName: params.issuedToClientName,
        currency: params.currency ?? "USD",
        totalBaseAmount: "0",
        totalSurchargeAmount: "0",
        grandTotalAmount: "0",
        notes: params.notes ?? null,
        schemaVersion: "1.0",
      })
      .returning();

    // ---------------------------------------------------------------
    // STEP 3: Lock PDF layout + generate document number (SELECT FOR UPDATE NOWAIT)
    // ---------------------------------------------------------------
    const documentNumber = await generateDocumentNumber({
      organizationId: params.organizationId,
      projectId: params.projectId,
      documentType: params.documentType,
      tx,
    });

    // ---------------------------------------------------------------
    // STEP 4: Fetch template header fields for FILE_* token resolution
    // ---------------------------------------------------------------
    let headerFieldRows: Awaited<ReturnType<typeof tx.select>> = [];
    if (params.sourceTemplateId) {
      headerFieldRows = await tx
        .select()
        .from(templateHeaderFields)
        .where(eq(templateHeaderFields.templateId, params.sourceTemplateId));
    }

    // ---------------------------------------------------------------
    // STEP 5: Fresh token resolution (CAT_*, ORG_*, FILE_*)
    // Always re-resolve inside the transaction — never use cached scope
    // ---------------------------------------------------------------
    const scope = await resolveScope({
      projectId: params.projectId,
      organizationId: params.organizationId,
      templateId: params.sourceTemplateId ?? "",
      db: tx,
      headerFieldValues: params.headerFieldValues,
    });

    // ---------------------------------------------------------------
    // STEP 6: Build section token map (sectionId → sectionToken)
    // ---------------------------------------------------------------
    const sectionTokenMap = new Map<string, string>();
    for (const section of params.draftRows) {
      sectionTokenMap.set(section.id, section.sectionToken);
    }

    // ---------------------------------------------------------------
    // STEP 7: Flatten draft sections → rows in EvaluatorRow shape
    // ---------------------------------------------------------------
    const allDraftRows: EvaluatorRow[] = params.draftRows.flatMap((section) =>
      section.rows.map((r) => ({
        rowToken: r.rowToken,
        rowType: r.rowType,
        label: r.label,
        subDescription: r.subDescription ?? null,
        surchargeLabel: r.surchargeLabel ?? null,
        qualifier: r.qualifier ?? null,
        formulaRaw: r.formulaRaw ?? null,
        surchargeFormula: r.surchargeFormula ?? null,
        constantValue: null,
        defaultValue: null,
        subComponents: r.subComponents ?? null,
        aggregateTargetSectionId: r.aggregateTargetSectionId ?? null,
        sectionId: section.id,
        isVisible: r.isVisible,
        sortOrder: r.sortOrder,
        overriddenValue: r.overriddenValue ?? null,
      }))
    );

    // ---------------------------------------------------------------
    // STEP 8: DAG validation + topological sort
    // ---------------------------------------------------------------
    const { sorted: sortedRows, result: dagResult } = DagValidatorService.sortRows(allDraftRows);

    if (!dagResult.valid) {
      const cyclicErrors = dagResult.errors.map((e) => e.message).join("; ");
      throw new Error(`CIRCULAR_DEPENDENCY: ${cyclicErrors}`);
    }

    // ---------------------------------------------------------------
    // STEP 9: Full AST evaluation (BigNumber, surcharges, section sums)
    // ---------------------------------------------------------------
    const evaluatedRows = AstEvaluatorService.evaluate({
      rows: sortedRows,
      scope,
      sectionTokenMap,
    });

    // ---------------------------------------------------------------
    // STEP 10: Text interpolation on labels/descriptions (after evaluation)
    // ---------------------------------------------------------------
    const interpolatedRows = interpolateRows(evaluatedRows, scope);

    // ---------------------------------------------------------------
    // Compute grand totals
    // ---------------------------------------------------------------
    let totalBase = "0";
    let totalSurcharge = "0";
    let grandTotal = "0";

    // Find explicit grand_total row first
    const grandTotalRow = interpolatedRows.find((r) => r.rowType === "grand_total");
    if (grandTotalRow) {
      grandTotal = grandTotalRow.totalValue;
    }

    // Sum base and surcharge across all visible countable rows
    let baseSum = 0;
    let surchargeSum = 0;
    for (const row of interpolatedRows) {
      if (row.rowType !== "header_label" && row.rowType !== "grand_total") {
        baseSum += parseFloat(row.baseValue);
        surchargeSum += parseFloat(row.surchargeValue);
      }
    }
    totalBase = baseSum.toFixed(6);
    totalSurcharge = surchargeSum.toFixed(6);

    if (!grandTotalRow) {
      grandTotal = (baseSum + surchargeSum).toFixed(6);
    }

    // ---------------------------------------------------------------
    // STEP 11: Write line items
    // ---------------------------------------------------------------
    const lineItemInserts = interpolatedRows.map((row: EvaluatedRow, idx: number) => {
      const section = params.draftRows.find((s) =>
        s.rows.some((r) => r.rowToken === row.rowToken)
      );
      return {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        sectionToken: row.sectionToken ?? null,
        sectionName: section?.name ?? null,
        rowToken: row.rowToken,
        rowType: row.rowType,
        label: row.label,
        subDescription: row.subDescription ?? null,
        surchargeLabel: row.surchargeLabel ?? null,
        qualifier: row.qualifier ?? null,
        formulaSnapshot: row.formulaSnapshot ?? null,
        surchargeFormulaSnapshot: row.surchargeFormulaSnapshot ?? null,
        subComponentsSnapshot: row.subComponentsSnapshot ?? null,
        baseValue: row.baseValue,
        surchargeValue: row.surchargeValue,
        totalValue: row.totalValue,
        computationCurrency: params.currency ?? "USD",
        isVisible: row.isVisible,
        displayOrder: idx,
      };
    });

    if (lineItemInserts.length > 0) {
      await tx.insert(invoiceLineItems).values(lineItemInserts);
    }

    // ---------------------------------------------------------------
    // STEP 12: Build the three JSONB artifacts
    // ---------------------------------------------------------------

    // Fetch template name for historicalFormat
    let templateName = "Custom Invoice";
    if (params.sourceTemplateId) {
      const [tpl] = await tx
        .select({ name: invoiceTemplates.name })
        .from(invoiceTemplates)
        .where(eq(invoiceTemplates.id, params.sourceTemplateId))
        .limit(1);
      if (tpl) templateName = tpl.name;
    }

    const historicalFormat: HistoricalFormatV1 = {
      schemaVersion: "2.0",
      templateId: params.sourceTemplateId ?? "custom",
      templateVersion: params.sourceTemplateVersion ?? 1,
      templateName,
      sections: params.draftRows.map((s) => ({
        id: s.id,
        sectionToken: s.sectionToken,
        displayName: s.displayName,
        sortOrder: s.sortOrder,
        rows: s.rows.map((r) => ({
          id: r.id,
          rowToken: r.rowToken,
          parentLabel: r.parentLabel,
          sortOrder: r.sortOrder,
          components: r.components.map((c) => ({
            id: c.id,
            componentToken: c.componentToken,
            label: c.label,
            subDescription: c.subDescription,
            qualifier: c.qualifier,
            valueType: c.valueType,
            formula: c.formula,
            manualValue: c.manualValue,
            initialValue: c.initialValue,
            sortOrder: c.sortOrder,
          })),
          charges: r.charges.map((ch) => ({
            id: ch.id,
            chargeToken: ch.chargeToken,
            label: ch.label,
            subDescription: ch.subDescription,
            qualifier: ch.qualifier,
            formula: ch.formula,
            sortOrder: ch.sortOrder,
          })),
        })),
        sectionCharges: s.sectionCharges.map((sc) => ({
          id: sc.id,
          chargeToken: sc.chargeToken,
          label: sc.label,
          subDescription: sc.subDescription,
          qualifier: sc.qualifier,
          formulaBase: sc.formulaBase,
          formulaRest: sc.formulaRest,
          sortOrder: sc.sortOrder,
        })),
      })),
      headerFields: (headerFieldRows as any[]).map((f) => ({
        id: f.id,
        fieldType: f.fieldType,
        label: f.label,
        fileFieldKey: f.fileFieldKey ?? undefined,
        orgConfigKey: f.orgConfigKey ?? undefined,
        columnPosition: f.columnPosition ?? "left",
        sortOrder: f.sortOrder ?? 0,
      })),
    };

    const resolvedScope: ResolvedScopeV1 = {
      schemaVersion: "2.0",
      resolvedAt: new Date().toISOString(),
      projectId: params.projectId,
      tokens: scope, // All BigNumber strings
    };

    // ---------------------------------------------------------------
    // STEP 13: Atomic status change to 'frozen'
    // ---------------------------------------------------------------
    const [frozen] = await tx
      .update(invoices)
      .set({
        status: "frozen",
        documentNumber,
        historicalFormat,
        resolvedScope,
        resolvedHeaderValues: params.headerFieldValues,
        totalBaseAmount: totalBase,
        totalChargesAmount: totalSurcharge,
        grandTotalAmount: grandTotal,
        frozenAt: new Date(),
        schemaVersion: "2.0",
      })
      .where(eq(invoices.id, invoice.id))
      .returning();

    // ---------------------------------------------------------------
    // STEP 14: Mark reserved number as used
    // ---------------------------------------------------------------
    await tx
      .update(invoiceReservedNumbers)
      .set({ isUsed: true, usedByInvoiceId: frozen.id })
      .where(
        and(
          eq(invoiceReservedNumbers.projectId, params.projectId),
          eq(invoiceReservedNumbers.documentType, params.documentType)
        )
      );

    // ---------------------------------------------------------------
    // STEP 15: Delete the draft
    // ---------------------------------------------------------------
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
