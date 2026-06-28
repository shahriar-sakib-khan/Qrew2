/**
 * DAG Validator Service — Invoice Engine V2
 *
 * Validates the dependency graph for the formula-driven invoice engine.
 *
 * Rules enforced:
 * 1. No circular dependencies.
 * 2. Forward reference prohibition — a formula may only reference tokens from
 *    rows that appear ABOVE in the template (lower sortOrder within the
 *    global top-to-bottom ordering across all sections).
 * 3. Charge scope restriction — row charges may ONLY reference:
 *      - the parent row's rowToken (base sum)
 *      - the parent row's componentTokens
 *    Section charges may ONLY reference:
 *      - SEC_<SECTION_TOKEN>_BASE
 *      - SEC_<SECTION_TOKEN>_TOTAL
 *      - SEC_<SECTION_TOKEN>_CHARGES
 *    Cross-row or cross-section references in charges = CHARGE_SCOPE_VIOLATION.
 * 4. Duplicate token detection.
 */

import {
  type EvaluatorSection,
  type EvaluatorRow,
  type EvaluatorRowCharge,
  type EvaluatorSectionCharge,
  type DagValidationResult,
  type EngineError,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts all bare token identifiers from a formula string.
 * Tokens are alphanumeric + underscore sequences (not numbers or operators).
 * e.g. "PORT_DUES * 0.15 + FILE_GRT" → ["PORT_DUES", "FILE_GRT"]
 */
function extractTokens(formula: string): string[] {
  // Match word-char sequences that are NOT pure numbers
  const matches = formula.match(/\b[A-Z_][A-Z0-9_]*\b/g);
  return matches ? [...new Set(matches)] : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LETTER COMPUTATION
// Mirrors the UI's auto-naming: A, B, C … Z, AA, AB …
// ─────────────────────────────────────────────────────────────────────────────
export function sectionIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAG VALIDATOR SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class DagValidatorService {
  /**
   * Validates the full template structure.
   *
   * @param sections - All sections in template sortOrder (ascending)
   * @param externalTokens - Tokens from FILE_*, ORG_*, CAT_* scopes (always valid)
   * @returns DagValidationResult with errors and safe evaluation order
   */
  static validate(
    sections: EvaluatorSection[],
    externalTokens: Set<string> = new Set()
  ): DagValidationResult {
    const errors: EngineError[] = [];
    const allKnownTokens = new Set<string>(externalTokens);
    /** Ordered list of tokens in safe evaluation order (output). */
    const topologicalOrder: string[] = [];

    // ── Duplicate token detection ──────────────────────────────────────────
    const tokenSeen = new Map<string, string>(); // token → first location label
    const seenTokens = new Set<string>();

    for (const section of sections) {
      const sectionLetter = sectionIndexToLetter(section.sortOrder);

      for (const row of section.rows) {
        // Check duplicate rowToken
        const rowLoc = `Row "${row.parentLabel}"`;
        if (seenTokens.has(row.rowToken)) {
          errors.push({
            code: "DUPLICATE_TOKEN",
            message: `Token "${row.rowToken}" is already used by ${tokenSeen.get(row.rowToken)}. Row tokens must be unique per template.`,
            rowToken: row.rowToken,
          });
        } else {
          seenTokens.add(row.rowToken);
          tokenSeen.set(row.rowToken, rowLoc);
        }

        for (const charge of row.charges) {
          if (seenTokens.has(charge.chargeToken)) {
            errors.push({
              code: "DUPLICATE_TOKEN",
              message: `Row charge token "${charge.chargeToken}" is already used by ${tokenSeen.get(charge.chargeToken)}.`,
              rowToken: row.rowToken,
              token: charge.chargeToken,
            });
          } else {
            seenTokens.add(charge.chargeToken);
            tokenSeen.set(charge.chargeToken, `row charge "${charge.label}" in row "${row.parentLabel}"`);
          }
        }
      }

      for (const sc of section.sectionCharges) {
        if (seenTokens.has(sc.chargeToken)) {
          errors.push({
            code: "DUPLICATE_TOKEN",
            message: `Section charge token "${sc.chargeToken}" is already used by ${tokenSeen.get(sc.chargeToken)}.`,
            token: sc.chargeToken,
          });
        } else {
          seenTokens.add(sc.chargeToken);
          tokenSeen.set(sc.chargeToken, `section charge "${sc.label}" in section "${sectionLetter}"`);
        }
      }
    }

    // If duplicate tokens found, abort further validation (results would be unreliable)
    if (errors.length > 0) {
      return { valid: false, topologicalOrder: [], errors };
    }

    // ── Forward-reference + charge scope validation ────────────────────────
    // Walk top-to-bottom. After processing each entity, add its token to
    // allKnownTokens so only previously-seen tokens can be referenced.

    for (const section of sections) {
      const sectionToken = section.sectionToken;
      const sectionLetter = sectionIndexToLetter(section.sortOrder);
      const sectionLabel = section.displayName ?? `Section ${sectionLetter}`;

      for (const row of section.rows) {
        // The set of tokens that this row's charges are ALLOWED to reference
        const rowChargeAllowedTokens = new Set<string>([
          row.rowToken,
          `${row.rowToken}_TOTAL`,
        ]);

        // ── Row base value formula (if formula type) ──
        if (row.formula) {
          const refs = extractTokens(row.formula);
          for (const ref of refs) {
            if (!allKnownTokens.has(ref)) {
              errors.push({
                code: "FORWARD_REFERENCE",
                message: `Row "${row.parentLabel}" references "${ref}" which has not been defined yet. Only tokens from rows appearing above this row may be used.`,
                rowToken: row.rowToken,
                token: ref,
                formula: row.formula,
              });
            }
          }
        }

        // Parent row base token — available after row evaluation
        allKnownTokens.add(row.rowToken);
        topologicalOrder.push(row.rowToken);

        // ── Row charges ──
        for (const charge of row.charges) {
          const refs = extractTokens(charge.formula);
          for (const ref of refs) {
            if (!rowChargeAllowedTokens.has(ref) && !externalTokens.has(ref)) {
              // Determine if it's a scope violation or forward reference
              const code = allKnownTokens.has(ref)
                ? "CHARGE_SCOPE_VIOLATION"
                : "FORWARD_REFERENCE";
              const message =
                code === "CHARGE_SCOPE_VIOLATION"
                  ? `Row charge "${charge.label}" in row "${row.parentLabel}" references "${ref}" which is outside this row's scope. Row charges may only reference their parent row's tokens.`
                  : `Row charge "${charge.label}" in row "${row.parentLabel}" references "${ref}" which has not been defined yet.`;
              errors.push({ code, message, rowToken: row.rowToken, token: ref, formula: charge.formula });
            }
          }
          allKnownTokens.add(charge.chargeToken);
          topologicalOrder.push(charge.chargeToken);
        }

        // Row TOTAL token (base + charges) — available after charges
        allKnownTokens.add(`${row.rowToken}_TOTAL`);
        topologicalOrder.push(`${row.rowToken}_TOTAL`);
      }

      // ── Section aggregate tokens — added after all rows in section ────────
      const secBase = `SEC_${sectionToken}_BASE`;
      const secTotal = `SEC_${sectionToken}_TOTAL`;
      const secCharges = `SEC_${sectionToken}_CHARGES`;
      allKnownTokens.add(secBase);
      allKnownTokens.add(secTotal);
      allKnownTokens.add(secCharges);
      topologicalOrder.push(secBase, secTotal, secCharges);

      const sectionChargeAllowedTokens = new Set<string>([secBase, secTotal, secCharges]);

      // ── Section charges ──
      for (const sc of section.sectionCharges) {
        const baseToken = `SEC_${sectionToken}_${sc.formulaBase}`;
        const fullFormula = `${baseToken}${sc.formulaRest}`;
        const refs = extractTokens(fullFormula);
        for (const ref of refs) {
          if (!sectionChargeAllowedTokens.has(ref) && !externalTokens.has(ref)) {
            const code = allKnownTokens.has(ref) ? "CHARGE_SCOPE_VIOLATION" : "FORWARD_REFERENCE";
            const message =
              code === "CHARGE_SCOPE_VIOLATION"
                ? `Section charge "${sc.label}" in section "${sectionLabel}" references "${ref}" which is outside this section's scope. Section charges may only reference SEC_${sectionToken}_BASE/TOTAL/CHARGES.`
                : `Section charge "${sc.label}" in section "${sectionLabel}" references "${ref}" which has not been defined.`;
            errors.push({ code, message, token: ref, formula: fullFormula });
          }
        }
        allKnownTokens.add(sc.chargeToken);
        topologicalOrder.push(sc.chargeToken);
      }
    }

    return {
      valid: errors.length === 0,
      topologicalOrder,
      errors,
    };
  }

  /**
   * Validates whether re-ordering a row to a new position would violate
   * any forward-reference rules.
   *
   * @param sections - Current sections array (before reorder)
   * @param movedRowToken - rowToken of the row being moved
   * @param newSortOrder - Proposed new sortOrder for the row
   * @param newSectionId - Proposed new sectionId (for cross-section moves)
   * @param externalTokens - Tokens always in scope (FILE_*, ORG_*, CAT_*)
   * @returns null if valid, EngineError if the reorder is forbidden
   */
  static validateReorder(
    sections: EvaluatorSection[],
    movedRowToken: string,
    newSortOrder: number,
    newSectionId: string,
    externalTokens: Set<string> = new Set()
  ): EngineError | null {
    // Simulate the reorder: update the moved row's sortOrder + sectionId
    const simulatedSections = sections.map((sec) => ({
      ...sec,
      rows: sec.rows.map((row) =>
        row.rowToken === movedRowToken
          ? { ...row, sortOrder: newSortOrder, sectionId: newSectionId }
          : row
      ),
    }));

    // Re-sort rows within each section
    simulatedSections.forEach((sec) => {
      sec.rows.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    const result = DagValidatorService.validate(simulatedSections, externalTokens);
    if (!result.valid) {
      const firstError = result.errors[0];
      return {
        code: "REORDER_VIOLATION",
        message: `Cannot move this row to the requested position. ${firstError.message}`,
        rowToken: movedRowToken,
        details: { originalErrors: result.errors },
      };
    }
    return null;
  }
}
