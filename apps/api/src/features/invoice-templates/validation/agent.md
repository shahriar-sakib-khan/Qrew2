# Formula Validation Submodule

**Location:** `apps/api/src/features/invoice-templates/validation/agent.md`  
**Binding Architectural Contract for AI Agents**

---

## 1. Responsibilities
- Validates user-supplied formulas before database persistence or evaluation.
- Enforces character whitelisting, mathematical AST parseability, and circular reference checks.

## 2. Invariants & Rules
1. **Allowed Character Whitelist**: Formulas may only contain uppercase letters `A-Z`, digits `0-9`, underscores `_`, decimal `.`, spaces, parentheses `(`, `)`, and operators `+`, `-`, `*`, `/`, `%`.
2. **Circular Reference Prevention**: When `currentToken` is provided, the formula is strictly rejected if it contains `currentToken` or `${currentToken}_TOTAL`.
3. **Empty / Null Handling**: A null or empty formula string is considered valid (treated as no formula / normal value).
4. **AST Verification**: Expressions must be valid mathematical expressions that parse under mathjs without syntax errors.

## 3. Files
- `formula-validator.ts`: Pure validation function `validateFormulaChars(formula, currentToken)`.
- `formula-validator.test.ts`: Unit tests validating all syntax branches and circular reference edge cases.
