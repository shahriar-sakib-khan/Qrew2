# Invoice Engine

## 1. Core Behavior and Invariants
- The engine calculates invoice templates using a custom abstract syntax tree (AST) evaluation process.
- **Topological Sorting:** The engine strictly evaluates rows in topological order using Kahn's Algorithm (`DagValidatorService`). This allows arbitrary forward references between rows within a section.
- **Single-Value Row Evaluation:** `EvaluatorRow` evaluates directly from `valueType` (`formula` vs `normal`), `formula`, or `initialValue` / `manualValue`. Sub-components are removed.
- **Base Token Scope Publication Order:** The row's base token (`rowToken`, e.g. `PORT_DUES`) MUST be computed and published into the evaluation `scope` BEFORE evaluating that row's charges. Once charges are evaluated, the derived total (`<rowToken>_TOTAL`) is published.
- **Formula Decoding at Eval Time:** Stored formulas use `{{$row:UUID}}` syntax. Before AST parsing, formulas are decoded via `decodeFormulaForEval(formula, idToToken)` to resolve current token names.
- **Circular Dependencies:** The validator strictly rejects circular dependencies, preventing infinite evaluation loops.
- **Namespace:** Only `SEC_<TOKEN>` (Section Base), `SEC_<TOKEN>_CHARGES`, `SEC_<TOKEN>_TOTAL`, and `ROW_<TOKEN>` (Row Base) are valid. `_BASE` suffixes have been entirely eliminated to simplify the system.

## 2. Data Model and Schema Mapping
- `template_rows` and `template_sections`: `label` (formerly `displayName` / `parentLabel`) represents the user-friendly name.
- `template_rows`: Stores `valueType`, `formula`, and `initialValue` directly.
- `template_section_charges`: Uses `formula` string field instead of split `formulaBase` and `formulaRest` fields. Formula evaluation dynamically extracts the correct target using the `formulaSnapshot` during eval.

## 3. PBAC Permission Logic
- Modification of template schemas (adding/removing rows and formulas) requires `invoice_templates:update`.
- Real-time engine evaluation in the API (`engine.controller.ts`) is open to any user with `invoice_templates:read` (for the builder preview) and `invoices:create` (for generating drafts).

## 4. Component Tree (Frontend context)
- Real-time client-side preview in the builder uses fixed-point iteration (`formula-evaluator.ts`) to simulate topological sorting without a heavy graph library, allowing immediate feedback as the user types forward references.
- Note: Both frontend and backend AST evaluators must expose base tokens prior to row charge evaluation.

## 5. API Surface
- `POST /engine/evaluate`: Main evaluation endpoint. Accepts sections, initialScope, and row index mapping (`idToToken`).
- `POST /sections/:sectionId/section-charges`: Expects a unified `formula` field (e.g., `"SEC_A * 0.10"`) rather than split base/rest values.
- **Evaluation Loop:** Tokens are parsed, topologically sorted (or rejected if cyclic), mapped into a `BigNumber` math scope, and iteratively reduced.

## 6. Error States
- `CIRCULAR_DEPENDENCY`: Fired during DAG validation if Kahn's algorithm detects a cycle.
- `INVALID_FORMULA_SYNTAX`: Fired if a row with `valueType=formula` has a missing or mathematically unparseable formula.
- `CHARGE_SCOPE_VIOLATION`: Fired if a section charge attempts to refer to a token outside its legal bounds (it must only refer to its parent section).

