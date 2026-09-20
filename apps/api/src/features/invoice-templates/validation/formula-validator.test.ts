import { describe, expect, it } from "vitest";
import { validateFormulaChars } from "./formula-validator";

describe("validateFormulaChars", () => {
  it("should pass for valid formulas", () => {
    expect(validateFormulaChars("ROW1 + ROW2 * 1.5").valid).toBe(true);
    expect(validateFormulaChars("(ROW1 + ROW2) / 2").valid).toBe(true);
  });

  it("should reject empty formulas", () => {
    expect(validateFormulaChars(null).valid).toBe(false);
    expect(validateFormulaChars("").valid).toBe(false);
    expect(validateFormulaChars("   ").valid).toBe(false);
  });

  it("should reject invalid characters", () => {
    const res = validateFormulaChars("ROW1 & ROW2");
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid character in formula: "&"');
  });

  it("should reject circular self-references", () => {
    const res = validateFormulaChars("PORT_DUES + 10", "PORT_DUES");
    expect(res.valid).toBe(false);
    expect(res.error).toContain(
      'Circular reference: a formula cannot reference its own token "PORT_DUES"',
    );
  });

  it("should reject circular references to own _TOTAL variant", () => {
    const res = validateFormulaChars("PORT_DUES_TOTAL * 0.5", "PORT_DUES");
    expect(res.valid).toBe(false);
    expect(res.error).toContain(
      'Circular reference: a formula cannot reference its own total "PORT_DUES_TOTAL"',
    );
  });

  it("should allow referencing different tokens", () => {
    const res = validateFormulaChars("LIGHT_CHARGES + 10", "PORT_DUES");
    expect(res.valid).toBe(true);
  });
});
