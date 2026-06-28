// @ts-nocheck
// TODO: [V2 Migration] engine.controller.ts uses V1 row shape — needs full rewrite
// to use EvaluatorSection/EvaluatorRow V2 interfaces.
import { Context } from "hono";
import { db, templateRows, templateSections } from "@starter/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { resolveScope } from "./token-resolver.service";
import { DagValidatorService } from "./dag-validator.service";
import { AstEvaluatorService, EvaluatorRow } from "./ast-evaluator.service";
import { interpolateRows } from "./text-interpolator.service";
import { DraftSectionV1 } from "./types";

const previewSchema = z.object({
  projectId: z.string(),
  templateId: z.string().optional(),
  draftRows: z.array(z.any()).optional(), // DraftSectionV1[]
  headerFieldValues: z.record(z.string(), z.string()).optional().default({}),
});

/**
 * POST /api/invoices/preview
 *
 * Per BACKEND_AGENT.md §9.8:
 * - Resolves token scope
 * - Gets rows from template OR from draft
 * - Runs DAG validation (returns errors inline without throwing)
 * - Runs AST evaluator
 * - Runs text interpolator
 * - Returns sections with evaluated rows, grandTotal, resolvedScope, validationErrors
 * - ZERO database writes — read-only computation
 */
export class EngineController {
  static async previewInvoice(c: Context) {
    try {
      const organizationId = c.get("organizationId") as string;
      if (!organizationId) {
        return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Organization context required" } }, 401);
      }

      const body = await c.req.json();
      const parsed = previewSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.format() } },
          400
        );
      }

      const { projectId, templateId, draftRows, headerFieldValues } = parsed.data;

      // ---------------------------------------------------------------
      // 1. Resolve the full token scope
      // ---------------------------------------------------------------
      const scope = await resolveScope({
        projectId,
        organizationId,
        templateId: templateId ?? "",
        db,
        headerFieldValues: headerFieldValues ?? {},
      });

      // ---------------------------------------------------------------
      // 2. Get rows — from template OR from draftRows
      // ---------------------------------------------------------------
      let evaluatorRows: EvaluatorRow[] = [];
      let sectionTokenMap = new Map<string, string>();
      let sectionsForResponse: Array<{
        id: string;
        name: string;
        sectionToken: string;
        sortOrder: number;
      }> = [];

      if (draftRows && draftRows.length > 0) {
        // Draft-based preview (Invoice Generator path)
        const sections = draftRows as DraftSectionV1[];
        for (const section of sections) {
          sectionTokenMap.set(section.id, section.sectionToken);
          sectionsForResponse.push({
            id: section.id,
            name: section.name,
            sectionToken: section.sectionToken,
            sortOrder: section.sortOrder,
          });
          for (const row of section.rows) {
            evaluatorRows.push({
              rowToken: row.rowToken,
              rowType: row.rowType,
              label: row.label,
              subDescription: row.subDescription ?? null,
              surchargeLabel: row.surchargeLabel ?? null,
              qualifier: row.qualifier ?? null,
              formulaRaw: row.formulaRaw ?? null,
              surchargeFormula: row.surchargeFormula ?? null,
              subComponents: row.subComponents ?? null,
              aggregateTargetSectionId: row.aggregateTargetSectionId ?? null,
              sectionId: section.id,
              isVisible: row.isVisible,
              sortOrder: row.sortOrder,
              overriddenValue: row.overriddenValue ?? null,
            });
          }
        }
      } else if (templateId) {
        // Template-based preview (Template Builder path)
        const [dbRows, dbSections] = await Promise.all([
          db.select().from(templateRows).where(eq(templateRows.templateId, templateId)),
          db.select().from(templateSections).where(eq(templateSections.templateId, templateId)),
        ]);

        for (const section of dbSections) {
          sectionTokenMap.set(section.id, section.sectionToken);
          sectionsForResponse.push({
            id: section.id,
            name: section.name,
            sectionToken: section.sectionToken,
            sortOrder: section.sortOrder,
          });
        }

        evaluatorRows = dbRows.map((r) => ({
          rowToken: r.rowToken,
          rowType: r.rowType,
          label: r.label,
          subDescription: r.subDescription ?? null,
          surchargeLabel: r.surchargeLabel ?? null,
          qualifier: r.qualifier ?? null,
          formulaRaw: r.formulaRaw ?? null,
          surchargeFormula: r.surchargeFormula ?? null,
          constantValue: r.constantValue ?? null,
          defaultValue: r.defaultValue ?? null,
          subComponents: r.subComponents ?? null,
          aggregateTargetSectionId: r.aggregateTargetSectionId ?? null,
          sectionId: r.sectionId ?? null,
          isVisible: r.isVisible,
          sortOrder: r.sortOrder ?? 0,
        }));
      }

      // ---------------------------------------------------------------
      // 3. DAG validation + topological sort (return errors, don't throw)
      // ---------------------------------------------------------------
      const { sorted: sortedRows, result: dagResult } = DagValidatorService.sortRows(evaluatorRows);

      // ---------------------------------------------------------------
      // 4. AST evaluation (even if DAG errors exist — show partial results)
      // ---------------------------------------------------------------
      let evaluatedRows = [];
      const evaluationErrors: Array<{ code: string; message: string; rowToken?: string }> = [
        ...dagResult.errors,
      ];

      if (evaluatorRows.length > 0) {
        try {
          evaluatedRows = AstEvaluatorService.evaluate({
            rows: sortedRows,
            scope,
            sectionTokenMap,
          });
        } catch (err: any) {
          if (err.__isEngineError) {
            evaluationErrors.push(err);
          } else {
            throw err; // unexpected error — let it bubble
          }
        }
      }

      // ---------------------------------------------------------------
      // 5. Text interpolation on labels/descriptions
      // ---------------------------------------------------------------
      const interpolated = interpolateRows(evaluatedRows, scope);

      // ---------------------------------------------------------------
      // 6. Group by section for response
      // ---------------------------------------------------------------
      const sectionMap = new Map(sectionsForResponse.map((s) => [s.id, s]));
      const sectionResultMap = new Map<string, {
        id: string;
        name: string;
        sectionToken: string;
        sortOrder: number;
        rows: typeof interpolated;
      }>();

      // Initialize section results
      for (const section of sectionsForResponse) {
        sectionResultMap.set(section.id, {
          ...section,
          rows: [],
        });
      }

      // Assign rows to sections
      const unsectionedRows: typeof interpolated = [];
      for (const row of interpolated) {
        const sectionId = evaluatorRows.find((r) => r.rowToken === row.rowToken)?.sectionId;
        if (sectionId && sectionResultMap.has(sectionId)) {
          sectionResultMap.get(sectionId)!.rows.push(row);
        } else {
          unsectionedRows.push(row);
        }
      }

      // Sort sections by sortOrder, sort rows within by displayOrder
      const sections = [...sectionResultMap.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          ...s,
          rows: s.rows.sort((a, b) => a.displayOrder - b.displayOrder),
        }));

      // ---------------------------------------------------------------
      // 7. Compute grand total
      // ---------------------------------------------------------------
      const grandTotalRow = interpolated.find((r) => r.rowType === "grand_total");
      let grandTotal = grandTotalRow?.totalValue ?? "0.000000";
      if (!grandTotalRow) {
        let sum = 0;
        for (const row of interpolated) {
          if (row.rowType !== "header_label" && row.rowType !== "grand_total") {
            sum += parseFloat(row.totalValue);
          }
        }
        grandTotal = sum.toFixed(6);
      }

      return c.json({
        success: true,
        data: {
          sections,
          unsectionedRows,
          grandTotal,
          resolvedScope: {
            schemaVersion: "1.0",
            resolvedAt: new Date().toISOString(),
            projectId,
            tokens: scope,
          },
          validationErrors: evaluationErrors,
        },
      });
    } catch (err: any) {
      console.error("[EngineController.previewInvoice]", err);
      return c.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to preview invoice" } },
        500
      );
    }
  }
}
