/**
 * Formula Evaluator — Client-side token map builder and formula evaluator.
 *
 * Takes fully-loaded sections data (with nested rows, charges, and sectionCharges)
 * and produces a flat map of token → computed number for live preview in the builder.
 *
 * Token hierarchy (computed in visual sort order — NOT topological order):
 *  1. Row base  = row.initialValue (manual-entry) or 0 for formula rows (external refs unknown)
 *  2. Row charge tokens = evaluated formula (e.g. PORT_DUES * 0.1)
 *  3. Row TOTAL = base + sum of row charges  (token: rowToken_TOTAL)
 *  4. SEC_X     = sum of all row bases in section (NOT SEC_X_BASE — no _BASE suffix)
 *  5. SEC_X_CHARGES = sum of all row charge amounts in section
 *  6. Section charges = evaluated formula (e.g. SEC_A * 0.1)
 *  7. SEC_X_TOTAL = SEC_X + SEC_X_CHARGES + section charge amounts
 *
 * NOTE: This evaluator uses VISUAL sort order, not topological order.
 * For templates with forward-referencing formulas, preview values for those
 * rows will show 0. The server-side AstEvaluatorService is authoritative.
 *
 * Note: Formula rows that reference external tokens (FILE_*, ORG_*, CAT_*) will
 * show 0 here since those external values aren't available at template-edit time.
 */

export type TokenMap = Record<string, number>;

/**
 * Decode an AST formula string from the database back to human-readable tokens.
 * - Replaces {{$row:UUID}} with the row's rowToken
 * - Strips {{ and }} from external tokens like {{FILE_GRT}}
 */
export function decodeFormula(formula: string | null | undefined, sections: any[], templateConstants?: any[]): string {
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

  // 1.5 Replace sec UUIDs
  const secRegex = /\{\{\$sec:([0-9a-fA-F-]+)\}\}/g;
  decoded = decoded.replace(secRegex, (match, id) => {
    const sec = (sections || []).find((s: any) => s.id === id);
    if (sec?.sectionToken) return `SEC_${sec.sectionToken}`;
    return match; // Fallback if not found
  });

  // 1.7 Replace tpl UUIDs
  const tplRegex = /\{\{\$tpl:([0-9a-fA-F-]+)\}\}/g;
  decoded = decoded.replace(tplRegex, (match, id) => {
    if (!templateConstants) return match;
    const arr = Array.isArray(templateConstants) ? templateConstants : Object.values(templateConstants);
    const constant = arr.find((c: any) => c.id === id);
    if (constant?.token) return constant.token;
    return match;
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

export function extractTokens(formula: string): string[] {
  if (!formula) return [];
  const matches = formula.match(/[A-Z_][A-Z0-9_]*/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Returns a set of all tokens that transitively depend on `targetToken`.
 * If any of these tokens are used in `targetToken`'s formula, a circular dependency occurs.
 */
export function getTransitiveDependents(
  targetToken: string,
  sections: any[],
  templateConstants?: any[]
): Set<string> {
  const graph = new Map<string, string[]>();

  const addEdge = (dependency: string, dependent: string) => {
    if (!graph.has(dependency)) graph.set(dependency, []);
    graph.get(dependency)!.push(dependent);
  };

  for (const section of sections) {
    const secBase = `SEC_${section.sectionToken}`;
    
    // Rows build into secBase
    for (const row of section.rows ?? []) {
      const rowBase = row.rowToken;
      const rowTotal = `${rowBase}_TOTAL`;
      addEdge(rowBase, secBase);
      addEdge(rowBase, rowTotal);

      if (row.valueType === "formula" && row.formula) {
        const decoded = decodeFormula(row.formula, sections, templateConstants);
        for (const t of extractTokens(decoded)) addEdge(t, rowBase);
      }

      for (const charge of row.charges ?? []) {
        if (!charge.chargeToken) continue;
        addEdge(charge.chargeToken, rowTotal);
        addEdge(charge.chargeToken, secBase); // row charges add to section base indirectly? actually sectionBase = sum(rowTotal)

        if (charge.formula) {
          const decoded = decodeFormula(charge.formula, sections, templateConstants);
          for (const t of extractTokens(decoded)) addEdge(t, charge.chargeToken);
        }
      }
    }

    // Section charges
    const secTotal = `${secBase}_TOTAL`;
    addEdge(secBase, secTotal);
    for (const sc of section.sectionCharges ?? []) {
      if (!sc.chargeToken) continue;
      addEdge(sc.chargeToken, secTotal);
      if (sc.formula) {
        const decoded = decodeFormula(sc.formula, sections, templateConstants);
        for (const t of extractTokens(decoded)) addEdge(t, sc.chargeToken);
      }
    }
  }

  // BFS to find all transitively dependent tokens
  const dependents = new Set<string>();
  const queue = [targetToken];
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const deps = graph.get(curr) || [];
    for (const d of deps) {
      if (!dependents.has(d)) {
        dependents.add(d);
        queue.push(d);
      }
    }
  }

  return dependents;
}

/**
 * Build the complete token map from template sections data.
 * Sections must already have .rows[].charges, .sectionCharges populated.
 * (rows no longer have .components)
 */
export function buildTokenMap(
  sections: any[],
  orgConfigs?: any[],
  templateConstants?: any[],
  fileFields?: any[]
): TokenMap {
  const tokens: TokenMap = {};

  // Inject global constants first so they are available for formulas
  if (orgConfigs) {
    for (const config of orgConfigs) {
      if (config.isFormulaInjectable && config.configKey) {
        const parsedVal = parseFloat(config.configValue);
        const val = isNaN(parsedVal) ? 0 : parsedVal;
        // If percentage, store the decimal value
        tokens[config.configKey] = config.valueType === "percentage" ? val / 100 : val;
      }
    }
  }

  // Inject template constants next
  if (templateConstants) {
    const constantsArray = Array.isArray(templateConstants) ? templateConstants : Object.values(templateConstants);
    for (const constant of constantsArray) {
      const parsedVal = parseFloat(constant.value ?? constant.defaultValue);
      const val = isNaN(parsedVal) ? 0 : parsedVal;
      const key = constant.key ?? constant.token;
      if (key) {
        tokens[key] = val;
      }
    }
  }

  // Inject file fields
  if (fileFields) {
    for (const field of fileFields) {
      if (field.isFormulaInjectable) {
        let token = `FILE_${(field.label || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
        if (field.fieldType === "file_field" && field.fileFieldKey) {
          token = `FILE_${field.fileFieldKey.toUpperCase()}`;
        } else if (field.fieldType === "org_config" && field.orgConfigKey) {
          token = `ORG_${field.orgConfigKey.toUpperCase()}`;
        }
        tokens[token] = 0;
      }
    }
  }

  // Initialize all known tokens to 0 so formulas can at least evaluate without returning null
  for (const section of sections) {
    tokens[`SEC_${section.sectionToken}`] = 0;
    tokens[`SEC_${section.sectionToken}_CHARGES`] = 0;
    tokens[`SEC_${section.sectionToken}_TOTAL`] = 0;
    for (const row of section.rows ?? []) {
      tokens[row.rowToken] = 0;
      tokens[`${row.rowToken}_TOTAL`] = 0;
      for (const charge of row.charges ?? []) {
        if (charge.chargeToken) tokens[charge.chargeToken] = 0;
      }
    }
    for (const sc of section.sectionCharges ?? []) {
      if (sc.chargeToken) tokens[sc.chargeToken] = 0;
    }
  }

  let changed = true;
  let passes = 0;

  while (changed && passes < 5) {
    changed = false;
    passes++;

    for (const section of sections) {
      const sectionToken: string = section.sectionToken;
      const rows: any[] = section.rows ?? [];
      const sectionCharges: any[] = section.sectionCharges ?? [];

      let sectionBase = 0;
      let sectionRowChargesTotal = 0;

      for (const row of rows) {
        const rowCharges: any[] = row.charges ?? [];

        let rowBase = 0;
        if (row.valueType === "formula" && row.formula) {
          // Decode first!
          const decoded = decodeFormula(row.formula, sections, templateConstants);
          const evaluated = evaluateFormula(decoded, tokens);
          if (evaluated !== null) {
            rowBase = evaluated;
          }
        } else if (row.valueType !== "formula" && row.initialValue != null) {
          const val = parseFloat(String(row.initialValue));
          if (!isNaN(val)) {
            rowBase = val;
          }
        }

        const rowTokenTotal = `${row.rowToken}_TOTAL`;
        if (tokens[row.rowToken] !== rowBase) {
          tokens[row.rowToken] = rowBase;
          changed = true;
        }

        let rowChargesSum = 0;
        for (const charge of rowCharges) {
          if (!charge.formula) continue;
          const decoded = decodeFormula(charge.formula, sections, templateConstants);
          const val = evaluateFormula(decoded, tokens);
          if (val !== null) {
            rowChargesSum += val;
            if (charge.chargeToken) {
              if (tokens[charge.chargeToken] !== val) changed = true;
              tokens[charge.chargeToken] = val;
            }
          }
        }

        const rowTotal = rowBase + rowChargesSum;
        if (tokens[rowTokenTotal] !== rowTotal) {
          tokens[rowTokenTotal] = rowTotal;
          changed = true;
        }

        sectionBase += rowBase;
        sectionRowChargesTotal += rowChargesSum;
      }

      if (tokens[`SEC_${sectionToken}`] !== sectionBase) {
        tokens[`SEC_${sectionToken}`] = sectionBase;
        changed = true;
      }
      if (tokens[`SEC_${sectionToken}_CHARGES`] !== sectionRowChargesTotal) {
        tokens[`SEC_${sectionToken}_CHARGES`] = sectionRowChargesTotal;
        changed = true;
      }

      let sectionChargesSum = 0;
      for (const sc of sectionCharges) {
        const decoded = decodeFormula(sc.formula, sections, templateConstants);
        const fullFormula = (decoded ?? "").trim();
        const val = evaluateFormula(fullFormula, tokens);
        if (val !== null) {
          sectionChargesSum += val;
          if (sc.chargeToken) {
            if (tokens[sc.chargeToken] !== val) changed = true;
            tokens[sc.chargeToken] = val;
          }
        }
      }

      const secTotal = sectionBase + sectionRowChargesTotal + sectionChargesSum;
      if (tokens[`SEC_${sectionToken}_TOTAL`] !== secTotal) {
        tokens[`SEC_${sectionToken}_TOTAL`] = secTotal;
        changed = true;
      }
    }
  }

  return tokens;
}

/** Round a number to 2 decimal places for display. */
export function fmt(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return "—";
  return val % 1 === 0 ? String(val) : val.toFixed(2);
}
