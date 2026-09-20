import { Context } from "hono";
import {
  db,
  templateRows,
  templateSections,
  templateHeaderFields,
  templateRowCharges,
  templateSectionCharges,
} from "@starter/db";
import type { RowIdToTokenMap } from "@starter/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { resolveScope } from "./token-resolver.service";
import { DagValidatorService } from "./dag-validator.service";
import { AstEvaluatorService } from "./ast-evaluator.service";
import type { EvaluatorSection, EvaluatorRow, EvaluatorRowCharge, EvaluatorSectionCharge } from "./types";

const previewSchema = z.object({
  projectId: z.string(),
  templateId: z.string().optional(),
  draftSections: z.array(z.any()).optional(),
  draftConstants: z.record(z.string(), z.any()).optional(),
  overrides: z.record(z.string(), z.string()).optional(),
  headerFieldValues: z.record(z.string(), z.string()).optional().default({}),
});

/**
 * POST /api/invoices/preview
 *
 * Resolves token scope, builds the V2 EvaluatorSection[] structure from the DB,
 * runs DAG validation + AST evaluation, and returns evaluated sections with
 * grandTotal, resolvedScope, and validationErrors.
 *
 * Zero database writes — read-only computation.
 */
export class EngineController {
  static async previewInvoice(c: Context) {
    try {
      const organizationId = c.get("organizationId") as string;
      if (!organizationId) {
        return c.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Organization context required" } },
          401
        );
      }

      const body = await c.req.json();
      const parsed = previewSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.format() } },
          400
        );
      }

      const { projectId, templateId, headerFieldValues } = parsed.data;

      // ─────────────────────────────────────────────────────────────────────
      // 1. Resolve full token scope (FILE_*, ORG_*, CAT_*)
      // ─────────────────────────────────────────────────────────────────────
      const scope = await resolveScope({
        projectId,
        organizationId,
        templateId: templateId ?? "",
        db,
        headerFieldValues: headerFieldValues ?? {},
      });

      // ─────────────────────────────────────────────────────────────────────
      // 2. Build EvaluatorSection[] from the database (template-based path)
      //    Phase 2 will add: draft-based path (draftRows with overrides)
      // ─────────────────────────────────────────────────────────────────────
      let evaluatorSections: EvaluatorSection[] = [];
      const { draftSections, overrides, draftConstants } = parsed.data;

      if (draftSections && draftSections.length > 0) {
        // Use provided draft sections directly
        evaluatorSections = draftSections;
        
        // Inject draft constants into scope as BigNumber-style strings so mathjs
        // arithmetic works correctly (scope values must all be numeric strings
        // like "111.000000", not raw JS numbers like 111).
        if (draftConstants) {
          for (const [key, val] of Object.entries(draftConstants)) {
            // val is { id, key, value: string|number, ... }
            const raw = val?.value ?? val;  // handle both object and primitive
            const numVal = parseFloat(String(raw));
            if (!isNaN(numVal)) {
              // Format as 6-decimal fixed string to match EngineContext convention
              const fixed = numVal.toFixed(6);
              scope[key] = fixed;
              scope[`TPL_${key}`] = fixed;
            }
          }
        }

        // Apply overrides to rows
        if (overrides && Object.keys(overrides).length > 0) {
          for (const sec of evaluatorSections) {
            for (const row of sec.rows) {
              if (overrides[row.rowToken] !== undefined) {
                row.manualValue = overrides[row.rowToken];
              }
            }
          }
        }
      } else if (templateId) {
        // Fetch sections, rows, and section charges in parallel
        const [dbSections, dbRows, dbSectionCharges] = await Promise.all([
          db
            .select()
            .from(templateSections)
            .where(eq(templateSections.templateId, templateId))
            .orderBy(templateSections.sortOrder),
          db
            .select()
            .from(templateRows)
            .where(eq(templateRows.templateId, templateId))
            .orderBy(templateRows.sortOrder),
          db
            .select()
            .from(templateSectionCharges)
            .where(eq(templateSectionCharges.templateId, templateId))
            .orderBy(templateSectionCharges.sortOrder),
        ]);

        // templateRowCharges has no templateId column — fetch by rowId list
        const rowIds = dbRows.map((r) => r.id);
        const dbRowCharges = rowIds.length > 0
          ? await db
              .select()
              .from(templateRowCharges)
              .where(inArray(templateRowCharges.rowId, rowIds))
              .orderBy(templateRowCharges.sortOrder)
          : [];

        // Build idToToken map: rowId → rowToken (for decoding {{$row:uuid}} refs)
        const idToToken: RowIdToTokenMap = {};
        for (const row of dbRows) {
          idToToken[row.id] = row.rowToken;
        }

        // Assemble the nested V2 EvaluatorSection[] structure
        evaluatorSections = dbSections.map((sec): EvaluatorSection => {
          const sectionRows = dbRows.filter((r) => r.sectionId === sec.id);
          const sectionSectionCharges = dbSectionCharges.filter((sc) => sc.sectionId === sec.id);

          const rows: EvaluatorRow[] = sectionRows.map((r): EvaluatorRow => {
            const rowCharges = dbRowCharges.filter((c) => c.rowId === r.id);

            const charges: EvaluatorRowCharge[] = rowCharges.map((c): EvaluatorRowCharge => ({
              id: c.id,
              chargeToken: c.chargeToken,
              label: c.label,
              subDescription: c.subDescription ?? undefined,
              qualifier: c.qualifier ?? undefined,
              tags: c.tags ?? undefined,
              formula: c.formula,
              sortOrder: c.sortOrder,
            }));

            return {
              id: r.id,
              rowToken: r.rowToken,
              parentLabel: r.parentLabel,
              sectionId: r.sectionId,
              valueType: r.valueType,       // 'normal' | 'formula'
              formula: r.formula ?? null,   // stored as {{$row:uuid}}, decoded in evaluator
              initialValue: r.initialValue ?? null,
              manualValue: null,            // no staff override on fresh template load
              charges,
              sortOrder: r.sortOrder,
            };
          });

          const sectionCharges: EvaluatorSectionCharge[] = sectionSectionCharges.map(
            (sc): EvaluatorSectionCharge => ({
              id: sc.id,
              chargeToken: sc.chargeToken,
              label: sc.label,
              subDescription: sc.subDescription ?? undefined,
              qualifier: sc.qualifier ?? undefined,
              tags: sc.tags ?? undefined,
              formulaBase: sc.formulaBase as "BASE" | "TOTAL" | "CHARGES",
              formulaRest: sc.formulaRest,
              sortOrder: sc.sortOrder,
            })
          );

          return {
            id: sec.id,
            sectionToken: sec.sectionToken,
            displayName: sec.displayName ?? undefined,
            sortOrder: sec.sortOrder,
            rows,
            sectionCharges,
          };
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3. DAG validation (runs on V2 EvaluatorSection[])
      // ─────────────────────────────────────────────────────────────────────
      const externalTokens = new Set(Object.keys(scope));
      const dagResult = DagValidatorService.validate(evaluatorSections, externalTokens);

      // ─────────────────────────────────────────────────────────────────────
      // 4. AST evaluation (V2 signature)
      // ─────────────────────────────────────────────────────────────────────
      const allValidationErrors: Array<{ code: string; message: string; rowToken?: string }> = [
        ...dagResult.errors,
      ];

      let evaluatedSections: any[] = [];
      let grandTotal = "0.000000";

      if (evaluatorSections.length > 0) {
        // Build idToToken from the sections we already assembled
        const idToToken: RowIdToTokenMap = {};
        for (const sec of evaluatorSections) {
          for (const row of sec.rows) {
            idToToken[row.id] = row.rowToken;
          }
        }

        const result = AstEvaluatorService.evaluate(
          evaluatorSections,
          scope,
          idToToken
        );
        evaluatedSections = result.evaluatedSections;
        grandTotal = result.grandTotal;
        allValidationErrors.push(...result.errors);

        // ── Collect per-row notices (e.g. UNRESOLVED_REFERENCE from zero-filled tokens) ──
        // These are soft warnings that don't abort evaluation but should be surfaced to the UI.
        for (const sec of evaluatedSections) {
          for (const row of (sec.rows ?? [])) {
            if (row.notices && row.notices.length > 0) {
              for (const notice of row.notices) {
                allValidationErrors.push({
                  ...notice,
                  // Ensure rowToken is always set so the frontend can match to the correct row
                  rowToken: notice.rowToken ?? row.rowToken,
                });
              }
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 5. Fetch header field definitions for the template (for display)
      // ─────────────────────────────────────────────────────────────────────
      let headerFieldDefs: any[] = [];
      if (templateId) {
        headerFieldDefs = await db
          .select()
          .from(templateHeaderFields)
          .where(eq(templateHeaderFields.templateId, templateId))
          .orderBy(templateHeaderFields.sortOrder);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 6. Return response
      //    evaluatedSections already grouped by section from the evaluator
      // ─────────────────────────────────────────────────────────────────────
      return c.json({
        success: true,
        data: {
          sections: evaluatedSections,
          grandTotal,
          headerFieldDefs,
          resolvedScope: {
            schemaVersion: "2.0",
            resolvedAt: new Date().toISOString(),
            projectId,
            tokens: scope,
          },
          validationErrors: allValidationErrors,
        },
      });
    } catch (err: any) {
      console.error("[EngineController.previewInvoice]", err);
      return c.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to preview invoice", details: err.message } },
        500
      );
    }
  }
}
