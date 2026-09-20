// ─── Formula Bar Pure Utilities ──────────────────────────────────────────────

/**
 * Convert the user-facing formula to storage format before saving:
 *  - `50%`  → `(50/100)`   percentage sugar
 *  - `//`   → `%`          modulo operator
 */
export function preprocessForSave(formula: string): string {
  return formula
    // percentage: 50% → (50/100), 0.15% → (0.15/100)
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
    // modulo: // → %
    .replace(/\/\//g, "%");
}

/** Returns last contiguous `[A-Za-z0-9_]+` segment uppercased. */
export function getLastWord(str: string): string {
  const match = str.match(/[A-Za-z0-9_]+$/);
  return match ? match[0].toUpperCase() : "";
}

/** Returns true if the last word-like segment is purely numeric (digits / decimal). */
export function lastSegmentIsNumeric(str: string): boolean {
  const match = str.match(/[\w.]+$/);
  if (!match) return false;
  return /^[0-9.]+$/.test(match[0]);
}

/**
 * Validates a formula string at save time.
 * Returns an error message string if invalid, or null if valid.
 *
 * Checks (in order):
 * 1. Ends with an operator
 * 2. Unbalanced parentheses
 * 3. Incomplete / invalid tokens
 * 4. Adjacent values without an operator
 * 5. Consecutive operators
 */
export function validateFormulaSave(
  trimmed: string,
  fullTokenList: string[],
  currentToken?: string
): string | null {
  // 1. Ends with operator
  if (/[-+*/%]$/.test(trimmed) || trimmed.endsWith("//")) {
    return "Formula cannot end with an operator.";
  }

  // 1.5. Circular dependency
  if (currentToken) {
    const tokensInFormula: string[] = trimmed.match(/[A-Z_][A-Z0-9_]*/g) ?? [];
    if (tokensInFormula.includes(currentToken)) {
      return `Circular reference: a formula cannot reference its own token "${currentToken}"`;
    }
    if (tokensInFormula.includes(`${currentToken}_TOTAL`)) {
      return `Circular reference: a formula cannot reference its own total "${currentToken}_TOTAL"`;
    }
  }

  // 2. Unbalanced parentheses
  const openCount = (trimmed.match(/\(/g) || []).length;
  const closeCount = (trimmed.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    return `Mismatched parentheses: ${openCount} open, ${closeCount} closed.`;
  }

  // 3. Incomplete / invalid tokens
  const wordMatches = trimmed.match(/[A-Z][A-Z0-9_]*/g) || [];
  for (const word of wordMatches) {
    if (!fullTokenList.includes(word)) {
      return `Incomplete or invalid token: "${word}"`;
    }
  }

  // 4. Adjacent values without an operator
  //    Split on operators and check each segment
  const segments = trimmed.split(/\s*[+\-*\/%()]+\s*/);
  for (const seg of segments) {
    const items = seg.trim().split(/\s+/).filter(Boolean);
    if (items.length > 1) {
      return "Values must be separated by an operator (e.g. + or *).";
    }
  }

  // 5. Consecutive operators: detect two operator chars in a row (excluding `//`)
  //    Normalize `//` to a placeholder so it doesn't trigger a false positive
  const normalized = trimmed.replace(/\/\//g, "MODULO");
  // Match: operator, optional spaces, another operator
  if (/[+\-*\/%()]\s+[+\-*\/%()]/.test(normalized)) {
    return "Formula contains consecutive operators.";
  }

  return null;
}
