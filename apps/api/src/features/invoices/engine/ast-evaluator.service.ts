// @ts-nocheck
// TODO: [V2 Migration] BigNumber ↔ mathjs type incompatibility — needs type-casting fix
// or replacement of mathjs with a pure BigNumber AST walker.
/**
 * AST Evaluator Service — Invoice Engine V2
 *
 * Evaluates the formula-driven invoice template in strict topological order:
 *
 *  For each section (in sortOrder):
 *    For each parent row (in sortOrder):
 *      1. Evaluate row base value (normal → initialValue/manualValue, formula → expression)
 *      2. rowToken = base value
 *      3. Evaluate each row charge formula (references rowToken as base)
 *      4. rowToken_TOTAL = rowToken + SUM(row charges)
 *    SEC_X_BASE    = SUM(rowToken values in section)
 *    SEC_X_CHARGES = SUM(all row charge values in section)
 *    SEC_X_TOTAL   = SEC_X_BASE + SEC_X_CHARGES
 *    For each section charge:
 *      Evaluate: SEC_X_{formulaBase} formulaRest
 *  INVOICE_TOTAL = SUM(SEC_X_TOTAL for all X + section charge values)
 *
 * Formula expressions use BARE token names (no {{}} delimiters).
 * Row references are stored as {{$row:UUID}} in DB and decoded before evaluation.
 * Text interpolation ({{TOKEN}} / ${{TOKEN}}) is handled separately by
 * text-interpolator.service.ts.
 */

import { create, all, type MathJsInstance } from "mathjs";
import {
  type EvaluatorSection,
  type EvaluatorRow,
  type EvaluatorRowCharge,
  type EvaluatorSectionCharge,
  type EvaluatedSection,
  type EvaluatedRow,
  type EvaluatedRowCharge,
  type EvaluatedSectionCharge,
  type EngineError,
  type EngineContext,
} from "./types";
import { decodeFormulaForEval, type RowIdToTokenMap } from "@starter/db";
import { sectionIndexToLetter } from "./dag-validator.service";

// ─────────────────────────────────────────────────────────────────────────────
// MATHJS CONFIGURATION — BigNumber, precision 20
// ─────────────────────────────────────────────────────────────────────────────
const math: MathJsInstance = create(all, {
  number: "BigNumber",
  precision: 20,
});

const ZERO = math.bignumber("0");
const FIXED_SCALE = 6;

function toFixed(val: ReturnType<typeof math.bignumber>): string {
  return math.format(val, { notation: "fixed", precision: FIXED_SCALE });
}

function safeBN(val: string | number | null | undefined): ReturnType<typeof math.bignumber> {
  try {
    if (val == null || val === "") return ZERO;
    return math.bignumber(String(val));
  } catch {
    return ZERO;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA EVALUATION (bare token names)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates a bare-token formula expression against the current scope.
 * Returns the BigNumber result or throws an EngineError on failure.
 *
 * Formula example: "PORT_DUES * 0.15 + FILE_GRT"
 * Scope example:   { PORT_DUES: "1000.000000", FILE_GRT: "4668.000000" }
 */
function evalFormula(
  formula: string,
  scope: EngineContext,
  contextLabel: string
): ReturnType<typeof math.bignumber> {
  try {
    const result = math.evaluate(formula, scope);
    if (result == null) throw new Error("Null result");
    return math.bignumber(result.toString());
  } catch (err) {
    throw {
      code: "EVALUATION_FAILED",
      message: `Failed to evaluate formula in ${contextLabel}: "${formula}". Error: ${(err as Error).message ?? String(err)}`,
      formula,
    } as EngineError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW CHARGE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRowCharge(
  charge: EvaluatorRowCharge,
  scope: EngineContext,
  rowLabel: string
): { result: EvaluatedRowCharge; value: ReturnType<typeof math.bignumber> } {
  const value = evalFormula(
    charge.formula,
    scope,
    `row charge "${charge.label}" in row "${rowLabel}"`
  );
  return {
    value,
    result: {
      id: charge.id,
      chargeToken: charge.chargeToken,
      label: charge.label,
      subDescription: charge.subDescription,
      qualifier: charge.qualifier,
      tags: charge.tags,
      formulaSnapshot: charge.formula,
      value: toFixed(value),
      sortOrder: charge.sortOrder,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CHARGE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

function evaluateSectionCharge(
  sc: EvaluatorSectionCharge,
  sectionToken: string,
  scope: EngineContext,
  sectionLabel: string
): { result: EvaluatedSectionCharge; value: ReturnType<typeof math.bignumber> } {
  const baseTokenName = `SEC_${sectionToken}_${sc.formulaBase}`;
  const fullFormula = `${baseTokenName}${sc.formulaRest}`;

  const value = evalFormula(
    fullFormula,
    scope,
    `section charge "${sc.label}" in section "${sectionLabel}"`
  );

  return {
    value,
    result: {
      id: sc.id,
      chargeToken: sc.chargeToken,
      label: sc.label,
      subDescription: sc.subDescription,
      qualifier: sc.qualifier,
      tags: sc.tags,
      formulaBase: sc.formulaBase,
      formulaRest: sc.formulaRest,
      formulaSnapshot: fullFormula,
      value: toFixed(value),
      sortOrder: sc.sortOrder,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW EVALUATION (single-value model)
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRow(
  row: EvaluatorRow,
  scope: EngineContext,
  sectionToken: string,
  idToToken: RowIdToTokenMap
): { result: EvaluatedRow; errors: EngineError[] } {
  const errors: EngineError[] = [];
  const evaluatedCharges: EvaluatedRowCharge[] = [];
  let baseValue = ZERO;
  let chargesValue = ZERO;

  // ── Evaluate row base value ──
  if (row.valueType === 'formula') {
    if (!row.formula) {
      errors.push({
        code: 'INVALID_FORMULA_SYNTAX',
        message: `Row "${row.parentLabel}" has valueType=formula but no formula is set.`,
        rowToken: row.rowToken,
      });
    } else {
      try {
        const decodedFormula = decodeFormulaForEval(row.formula, idToToken);
        baseValue = evalFormula(decodedFormula, scope, `row "${row.parentLabel}"`);
      } catch (err) {
        errors.push(err as EngineError);
      }
    }
  } else {
    // normal — use manualValue (staff override) > initialValue > 0
    const raw = row.manualValue ?? row.initialValue ?? null;
    baseValue = safeBN(raw);
  }

  // ── Publish row base token ──
  scope[row.rowToken] = toFixed(baseValue);

  // ── Evaluate row charges ──
  const sortedCharges = [...row.charges].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const charge of sortedCharges) {
    try {
      // Decode charge formula too
      const decodedCharge = { ...charge, formula: decodeFormulaForEval(charge.formula, idToToken) };
      const { result, value } = evaluateRowCharge(decodedCharge, scope, row.parentLabel);
      evaluatedCharges.push(result);
      scope[charge.chargeToken] = toFixed(value);
      chargesValue = math.add(chargesValue, value) as ReturnType<typeof math.bignumber>;
    } catch (err) {
      errors.push(err as EngineError);
      scope[charge.chargeToken] = '0.000000';
    }
  }

  // ── Publish row total token ──
  const totalValue = math.add(baseValue, chargesValue) as ReturnType<typeof math.bignumber>;
  scope[`${row.rowToken}_TOTAL`] = toFixed(totalValue);

  return {
    errors,
    result: {
      id: row.id,
      rowToken: row.rowToken,
      parentLabel: row.parentLabel,
      sectionToken,
      charges: evaluatedCharges,
      baseValue: toFixed(baseValue),
      chargesValue: toFixed(chargesValue),
      totalValue: toFixed(totalValue),
      sortOrder: row.sortOrder,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

function evaluateSection(
  section: EvaluatorSection,
  scope: EngineContext,
  idToToken: RowIdToTokenMap
): { result: EvaluatedSection; errors: EngineError[] } {
  const errors: EngineError[] = [];
  const evaluatedRows: EvaluatedRow[] = [];
  const evaluatedSectionCharges: EvaluatedSectionCharge[] = [];
  const sectionToken = section.sectionToken;
  const autoName = sectionIndexToLetter(section.sortOrder);
  const sectionLabel = section.displayName ?? `Section ${autoName}`;

  let sectionBase = ZERO;
  let sectionChargesTotal = ZERO;

  // Sort rows by sortOrder
  const sortedRows = [...section.rows].sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Evaluate rows ──
  for (const row of sortedRows) {
    const { result, errors: rowErrors } = evaluateRow(row, scope, sectionToken, idToToken);
    evaluatedRows.push(result);
    errors.push(...rowErrors);

    sectionBase = math.add(sectionBase, safeBN(result.baseValue)) as ReturnType<typeof math.bignumber>;
    sectionChargesTotal = math.add(
      sectionChargesTotal,
      safeBN(result.chargesValue)
    ) as ReturnType<typeof math.bignumber>;
  }

  const sectionTotal = math.add(sectionBase, sectionChargesTotal) as ReturnType<typeof math.bignumber>;

  // ── Section aggregate tokens ──
  scope[`SEC_${sectionToken}_BASE`] = toFixed(sectionBase);
  scope[`SEC_${sectionToken}_CHARGES`] = toFixed(sectionChargesTotal);
  scope[`SEC_${sectionToken}_TOTAL`] = toFixed(sectionTotal);

  // ── Section charges ──
  const sortedSectionCharges = [...section.sectionCharges].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const sc of sortedSectionCharges) {
    try {
      const { result, value } = evaluateSectionCharge(sc, sectionToken, scope, sectionLabel);
      evaluatedSectionCharges.push(result);
      scope[sc.chargeToken] = toFixed(value);
    } catch (err) {
      errors.push(err as EngineError);
      scope[sc.chargeToken] = "0.000000";
    }
  }

  return {
    errors,
    result: {
      id: section.id,
      sectionToken,
      displayName: section.displayName,
      autoName,
      rows: evaluatedRows,
      sectionCharges: evaluatedSectionCharges,
      sectionBase: toFixed(sectionBase),
      sectionChargesTotal: toFixed(sectionChargesTotal),
      sectionTotal: toFixed(sectionTotal),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EVALUATOR SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class AstEvaluatorService {
  /**
   * Evaluates all sections in the template and returns the full evaluated
   * structure plus the grand total and any evaluation errors.
   *
   * @param sections     - All sections in sortOrder (already DAG-validated)
   * @param initialScope - Pre-resolved external tokens (FILE_*, ORG_*, CAT_*)
   * @param idToToken    - Map of rowId → rowToken for formula decoding
   */
  static evaluate(
    sections: EvaluatorSection[],
    initialScope: Record<string, string> = {},
    idToToken: RowIdToTokenMap = {}
  ): {
    evaluatedSections: EvaluatedSection[];
    grandTotal: string;
    errors: EngineError[];
  } {
    const errors: EngineError[] = [];
    const evaluatedSections: EvaluatedSection[] = [];
    let grandTotal = ZERO;

    // Build mutable scope, starting with external tokens
    const scope: EngineContext = { ...initialScope };

    // Sort sections by sortOrder
    const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const section of sortedSections) {
      const { result, errors: sectionErrors } = evaluateSection(section, scope, idToToken);
      evaluatedSections.push(result);
      errors.push(...sectionErrors);

      // Grand total accumulates section totals + section charge values
      grandTotal = math.add(grandTotal, safeBN(result.sectionTotal)) as ReturnType<typeof math.bignumber>;

      // Add section charge values to grand total
      for (const sc of result.sectionCharges) {
        grandTotal = math.add(grandTotal, safeBN(sc.value)) as ReturnType<typeof math.bignumber>;
      }
    }

    // Inject INVOICE_TOTAL into scope (useful for any post-evaluation references)
    scope["INVOICE_TOTAL"] = toFixed(grandTotal);

    return {
      evaluatedSections,
      grandTotal: toFixed(grandTotal),
      errors,
    };
  }
}
