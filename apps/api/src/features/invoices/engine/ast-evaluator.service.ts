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

import { create, all, type MathJsInstance, type BigNumber } from "mathjs";
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

function toFixed(val: BigNumber): string {
  return math.format(val, { notation: "fixed", precision: FIXED_SCALE });
}

function safeBN(val: string | number | null | undefined): BigNumber {
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
 * @param noticeCollector - If provided, unknown tokens are zero-filled and
 *   an UNRESOLVED_REFERENCE notice is pushed here instead of throwing.
 */
function evalFormula(
  formula: string,
  scope: EngineContext,
  contextLabel: string,
  noticeCollector?: EngineError[]
): BigNumber {
  const TOKEN_RE = /\b([A-Z_][A-Z0-9_]*)\b/g;
  let resolvedFormula = formula;
  if (noticeCollector !== undefined) {
    const unknownTokens = new Set<string>();
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(formula)) !== null) {
      const tok = m[1];
      if (!(tok in scope)) unknownTokens.add(tok);
    }
    for (const tok of unknownTokens) {
      noticeCollector.push({
        code: "UNRESOLVED_REFERENCE",
        message: `Token "${tok}" is not yet defined — treated as 0.`,
        token: tok,
        formula,
      } as EngineError);
      resolvedFormula = resolvedFormula.replace(
        new RegExp(`\\b${tok}\\b`, "g"),
        "0"
      );
    }
  }

  try {
    const result = math.evaluate(resolvedFormula, scope);
    if (result == null) throw new Error("Null result");
    return math.bignumber(result.toString());
  } catch (err: any) {
    throw {
      code: "EVALUATION_FAILED",
      message: `Failed to evaluate formula in ${contextLabel}: "${formula}". Error: ${err?.message ?? String(err)}`,
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
): { result: EvaluatedRowCharge; value: BigNumber } {
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
): { result: EvaluatedSectionCharge; value: BigNumber } {
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
  const notices: EngineError[] = [];
  const evaluatedCharges: EvaluatedRowCharge[] = [];
  let baseValue = ZERO;
  let chargesValue = ZERO;

  // ── Evaluate row base value ──
  if (row.valueType === "formula") {
    if (!row.formula) {
      errors.push({
        code: "INVALID_FORMULA_SYNTAX",
        message: `Row "${row.parentLabel}" has valueType=formula but no formula is set.`,
        rowToken: row.rowToken,
      });
    } else {
      try {
        const decodedFormula = decodeFormulaForEval(row.formula, idToToken);
        baseValue = evalFormula(decodedFormula, scope, `row "${row.parentLabel}"`, notices);
      } catch (err: any) {
        errors.push({ ...(err as EngineError), rowToken: row.rowToken });
      }
    }
  } else {
    const raw = row.manualValue ?? row.initialValue ?? null;
    baseValue = safeBN(raw);
  }

  // ── Publish row base tokens ──
  scope[row.rowToken] = toFixed(baseValue);
  scope[`${row.rowToken}_BASE`] = toFixed(baseValue);

  // ── Evaluate row charges ──
  const sortedCharges = [...row.charges].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const charge of sortedCharges) {
    try {
      const decodedCharge = { ...charge, formula: decodeFormulaForEval(charge.formula, idToToken) };
      const { result, value } = evaluateRowCharge(decodedCharge, scope, row.parentLabel);
      evaluatedCharges.push(result);
      scope[charge.chargeToken] = toFixed(value);
      chargesValue = math.add(chargesValue, value) as BigNumber;
    } catch (err: any) {
      errors.push({ ...(err as EngineError), rowToken: row.rowToken });
      scope[charge.chargeToken] = "0.000000";
    }
  }

  // ── Publish row total token ──
  const totalValue = math.add(baseValue, chargesValue) as BigNumber;
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
      notices: notices.length > 0 ? notices : undefined,
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
  let rowChargesSum = ZERO;

  const sortedRows = [...section.rows].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const row of sortedRows) {
    const { result, errors: rowErrors } = evaluateRow(row, scope, sectionToken, idToToken);
    evaluatedRows.push(result);
    errors.push(...rowErrors);

    sectionBase = math.add(sectionBase, safeBN(result.baseValue)) as BigNumber;
    rowChargesSum = math.add(rowChargesSum, safeBN(result.chargesValue)) as BigNumber;
  }

  const sectionTotal = math.add(sectionBase, rowChargesSum) as BigNumber;

  // ── Section aggregate tokens ──
  scope[`SEC_${sectionToken}_BASE`] = toFixed(sectionBase);
  scope[`SEC_${sectionToken}_CHARGES`] = toFixed(rowChargesSum);
  scope[`SEC_${sectionToken}_TOTAL`] = toFixed(sectionTotal);

  // ── Section charges ──
  const sortedSectionCharges = [...section.sectionCharges].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const sc of sortedSectionCharges) {
    try {
      const { result, value } = evaluateSectionCharge(sc, sectionToken, scope, sectionLabel);
      evaluatedSectionCharges.push(result);
      scope[sc.chargeToken] = toFixed(value);
    } catch (err: any) {
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
      sectionChargesTotal: toFixed(rowChargesSum),
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
   * @param initialScope - Pre-resolved external tokens (FILE_*, GBL_*, TPL_*, EXP_*)
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

    const scope: EngineContext = { ...initialScope };
    const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const section of sortedSections) {
      const { result, errors: sectionErrors } = evaluateSection(section, scope, idToToken);
      evaluatedSections.push(result);
      errors.push(...sectionErrors);

      grandTotal = math.add(grandTotal, safeBN(result.sectionTotal)) as BigNumber;

      for (const sc of result.sectionCharges) {
        grandTotal = math.add(grandTotal, safeBN(sc.value)) as BigNumber;
      }
    }

    scope["INVOICE_TOTAL"] = toFixed(grandTotal);

    return {
      evaluatedSections,
      grandTotal: toFixed(grandTotal),
      errors,
    };
  }
}

