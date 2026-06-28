/**
 * Formula Evaluator — Client-side token map builder and formula evaluator.
 *
 * Takes fully-loaded sections data (with nested rows, charges, and sectionCharges)
 * and produces a flat map of token → computed number.
 *
 * Token hierarchy (computed in dependency order):
 *  1. Row base  = row.initialValue (manual-entry) or 0 for formula rows (external refs unknown)
 *  2. Row charge tokens = evaluated formula (e.g. PORT_DUES_TOTAL * 0.1)
 *  3. Row TOTAL = base + sum of row charges
 *  4. SEC_X_BASE = sum of all row bases in section
 *  5. SEC_X_CHARGES = sum of all row charge amounts in section
 *  6. Section charges = evaluated formula (e.g. SEC_A_BASE * 0.1)
 *  7. SEC_X_TOTAL = BASE + CHARGES + section charge amounts
 *
 * Note: Formula rows that reference external tokens (FILE_*, ORG_*, CAT_*) will
 * show 0 here in the builder preview since those external values aren't available
 * at template-edit time. This is expected behavior — the real values are resolved
 * by the invoice engine at invoice-generation time.
 */

export type TokenMap = Record<string, number>;

/**
 * Decode an AST formula string from the database back to human-readable tokens.
 * - Replaces {{$row:UUID}} with the row's rowToken
 * - Strips {{ and }} from external tokens like {{FILE_GRT}}
 */
export function decodeFormula(formula: string | null | undefined, sections: any[]): string {
  if (!formula) return "";
  let decoded = formula;

  // 1. Replace row UUIDs
  const rowRegex = /\{\{\$row:([0-9a-fA-F-]+)\}\}/g;
  decoded = decoded.replace(rowRegex, (match, id) => {
    for (const sec of (sections || [])) {
      const row = sec.rows?.find((r: any) => r.id === id);
      if (row?.rowToken) return row.rowToken;
    }
    return match; // Fallback if not found
  });

  // 2. Strip {{ and }} from other tokens
  decoded = decoded.replace(/\{\{([A-Z0-9_]+)\}\}/g, "$1");

  return decoded;
}

/**
 * Safely evaluate an arithmetic expression string where all identifiers have
 * already been substituted with numeric literals.
 * Returns null if evaluation fails or result is not finite.
 */
function safeEval(expr: string): number | null {
  try {
    // Validate: after substitution, only digits, operators, and whitespace/parens
    // should remain. Reject anything else to prevent code injection.
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr.trim())) return null;
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)() as number;
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Evaluate a formula string by substituting known token values.
 * Tokens are substituted longest-first to avoid partial matches
 * (e.g., PORT_DUES_TOTAL substituted before PORT_DUES).
 *
 * Returns the numeric result, or null if any token is unresolved.
 */
export function evaluateFormula(formula: string, tokens: TokenMap): number | null {
  if (!formula?.trim()) return null;

  // Sort tokens longest-first to avoid substring replacement issues
  const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

  let expr = formula.trim();
  for (const token of sortedTokens) {
    // Use word-boundary-like replacement: token must not be preceded/followed
    // by another word character to avoid partial matches.
    expr = expr.replace(new RegExp(`(?<![A-Z0-9_])${token}(?![A-Z0-9_])`, "g"), String(tokens[token]));
  }

  return safeEval(expr);
}

/**
 * Build the complete token map from template sections data.
 * Sections must already have .rows[].charges, .sectionCharges populated.
 * (rows no longer have .components)
 */
export function buildTokenMap(sections: any[], orgConfigs?: any[]): TokenMap {
  const tokens: TokenMap = {};

  // Inject global constants first so they are available for formulas
  if (orgConfigs) {
    for (const config of orgConfigs) {
      if (config.isFormulaInjectable) {
        const val = parseFloat(config.configValue);
        if (!isNaN(val)) {
          // If percentage, store the decimal value
          tokens[config.configKey] = config.valueType === "percentage" ? val / 100 : val;
        }
      }
    }
  }

  for (const section of sections) {
    const sectionToken: string = section.sectionToken;
    const rows: any[] = section.rows ?? [];
    const sectionCharges: any[] = section.sectionCharges ?? [];

    let sectionBase = 0;
    let sectionRowChargesTotal = 0;

    for (const row of rows) {
      const rowCharges: any[] = row.charges ?? [];

      // ── 1. Row base value ──────────────────────────────────────────────────
      // For normal rows: use initialValue if set.
      // For formula rows: we can only evaluate if all referenced tokens are in our map.
      let rowBase = 0;
      if (row.valueType === "formula" && row.formula) {
        const evaluated = evaluateFormula(row.formula, tokens);
        if (evaluated !== null) {
          rowBase = evaluated;
        }
        // if null: external refs missing — stays 0 in builder preview
      } else if (row.valueType !== "formula" && row.initialValue != null) {
        const val = parseFloat(String(row.initialValue));
        if (!isNaN(val)) {
          rowBase = val;
        }
      }

      // ── 2. Evaluate row charges ────────────────────────────────────────────
      // Expose the preliminary base token so charge formulas can reference ROW_X_TOTAL
      const rowTokenTotal = `${row.rowToken}_TOTAL`;
      tokens[rowTokenTotal] = rowBase; // preliminary — updated below

      let rowChargesSum = 0;
      for (const charge of rowCharges) {
        if (!charge.formula) continue;
        const val = evaluateFormula(charge.formula, tokens);
        if (val !== null) {
          rowChargesSum += val;
          if (charge.chargeToken) tokens[charge.chargeToken] = val;
        }
      }

      // ── 3. Row TOTAL = base + charges ──────────────────────────────────────
      const rowTotal = rowBase + rowChargesSum;
      tokens[rowTokenTotal] = rowTotal;
      tokens[row.rowToken] = rowBase; // base token (without charges)

      sectionBase += rowBase;
      sectionRowChargesTotal += rowChargesSum;
    }

    // ── 4. Section aggregate tokens ───────────────────────────────────────────
    tokens[`SEC_${sectionToken}_BASE`] = sectionBase;
    tokens[`SEC_${sectionToken}_CHARGES`] = sectionRowChargesTotal;

    // ── 5. Evaluate section charges ───────────────────────────────────────────
    let sectionChargesSum = 0;
    for (const sc of sectionCharges) {
      // Reconstruct the full formula from formulaBase + formulaRest
      const fullFormula = `SEC_${sectionToken}_${sc.formulaBase} ${sc.formulaRest ?? ""}`.trim();
      const val = evaluateFormula(fullFormula, tokens);
      if (val !== null) {
        sectionChargesSum += val;
        if (sc.chargeToken) tokens[sc.chargeToken] = val;
      }
    }

    // ── 6. Section TOTAL ──────────────────────────────────────────────────────
    tokens[`SEC_${sectionToken}_TOTAL`] = sectionBase + sectionRowChargesTotal + sectionChargesSum;
  }

  return tokens;
}

/** Round a number to 2 decimal places for display. */
export function fmt(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return "—";
  return val % 1 === 0 ? String(val) : val.toFixed(2);
}
