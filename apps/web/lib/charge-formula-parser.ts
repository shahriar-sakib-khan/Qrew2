export type SimpleChargeFormula = {
  operator: "*" | "/" | "+" | "-";
  value: number;
  unit: "percent" | "fixed";
};

/**
 * Attempts to parse a raw formula string into the simple structured format:
 * [baseToken] [operator] [value] [%?]
 *
 * Example:
 * "PORT_DUES * 0.15" -> { operator: '*', value: 15, unit: 'percent' }
 * "PORT_DUES + 500" -> { operator: '+', value: 500, unit: 'fixed' }
 * "SEC_FEES * 0.1" -> { operator: '*', value: 10, unit: 'percent' }
 *
 * @param formula The raw formula string from the DB (decoded format)
 * @param baseToken The base token for the row or section (e.g. 'PORT_DUES' or 'SEC_FEES')
 * @returns SimpleChargeFormula if it matches the pattern, null if it's too complex
 */
export function parseChargeFormula(
  formula: string,
  baseToken: string
): SimpleChargeFormula | null {
  if (!formula || !formula.trim()) return null;

  const raw = formula.trim();

  // We are looking for exactly: baseToken <space> operator <space> number
  // or baseToken operator number
  // E.g. "PORT_DUES * 0.15", "PORT_DUES+500"

  // Regex breakdown:
  // ^\s*                     -> optional leading space
  // (BASE_TOKEN)             -> the exact base token (escaped just in case)
  // \s*                      -> optional space
  // ([\*\/\+\-])             -> operator: *, /, +, -
  // \s*                      -> optional space
  // (-?\d+(?:\.\d+)?)        -> value (number with optional decimal)
  // \s*$                     -> optional trailing space

  const escapedToken = baseToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s*${escapedToken}\\s*([\\*\\/\\+\\-])\\s*(-?\\d+(?:\\.\\d+)?)\\s*$`
  );

  const match = raw.match(pattern);
  if (!match) return null;

  const operator = match[1] as "*" | "/" | "+" | "-";
  const numValue = parseFloat(match[2]);

  if (isNaN(numValue)) return null;

  // Let's deduce unit and actual display value based on common patterns.
  // Generally, if it's multiplication by a decimal < 1 (e.g. 0.15), it's a percentage.
  // Wait, what if they explicitly type 15 for a percentage? We store it as * 0.15.
  // So if operator is '*' and value is something like 0.15, we can show it as 15%.
  // If operator is '*' and they entered 2, it's 200%.
  // To keep it simple: if operator is '*' or '/', we assume it's a percentage if it makes sense,
  // or maybe we just always treat '*' and '/' as percentage multiplier?
  // Let's say:
  // If it's `PORT_DUES * X`, it could be "X * 100" percent.
  // E.g. 0.15 -> 15%. 1 -> 100%.
  
  if (operator === "*") {
    // Treat as percentage multiplier
    // To avoid floating point issues (e.g. 0.15 * 100 = 15.000000000000002)
    // we use Math.round or similar, but for UI we might just use string manipulation or a small precision round.
    const percentValue = Math.round(numValue * 100 * 10000) / 10000;
    return {
      operator: "*",
      value: percentValue,
      unit: "percent",
    };
  }

  // If it's '+' or '-', it's fixed.
  if (operator === "+" || operator === "-") {
    return {
      operator: operator,
      value: numValue,
      unit: "fixed",
    };
  }
  
  // If it's '/', maybe treat as fixed divisor? Like / 2?
  // Or percentage? Usually you do / 100. Let's just fall back to fixed for division.
  if (operator === "/") {
    return {
      operator: operator,
      value: numValue,
      unit: "fixed",
    };
  }

  return null;
}

/**
 * Builds a raw formula string from a structured SimpleChargeFormula.
 */
export function buildChargeFormula(
  data: SimpleChargeFormula,
  baseToken: string
): string {
  if (data.operator === "*") {
    // For percentage, value is e.g. 15. We store 0.15
    if (data.unit === "percent") {
      const storedValue = data.value / 100;
      return `${baseToken} * ${storedValue}`;
    }
  }

  // Fallback for everything else
  return `${baseToken} ${data.operator} ${data.value}`;
}
