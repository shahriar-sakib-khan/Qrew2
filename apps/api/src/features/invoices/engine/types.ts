/**
 * Invoice Engine — Core TypeScript Types (V2)
 *
 * This is the canonical types file for the invoice engine layer.
 * All engine services import from here.
 *
 * For the database/shared layer, see @starter/db schema/invoice-types.ts
 * (which mirrors the interfaces here for JSONB columns).
 */

// Re-export all shared JSONB interfaces from the db package
export type {
  ComponentValueType,
  LineType,
  HeaderFieldType,
  HistoricalFormatV2,
  HistoricalSectionV2,
  HistoricalRowV2,
  HistoricalComponentV2,
  HistoricalRowChargeV2,
  HistoricalSectionChargeV2,
  ResolvedScopeV2,
  DraftSectionV2,
  DraftRowV2,
  DraftComponentV2,
  DraftRowChargeV2,
  DraftSectionChargeV2,
  BankDetailsV1,
  ExtraSectionV1,
  FooterBlockV1,
  // Compat aliases during migration
  HistoricalFormatV1,
  ResolvedScopeV1,
  DraftSectionV1,
  DraftRowV1,
} from "@starter/db";

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATOR INPUT TYPES
// These are the shapes the engine services work with internally.
// ─────────────────────────────────────────────────────────────────────────────

/** A row charge fed into the evaluator. */
export interface EvaluatorRowCharge {
  id: string;
  chargeToken: string;           // e.g. PORT_DUES_VAT_15
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  /** Bare token expression. Primary operand must be the parent rowToken. */
  formula: string;
  sortOrder: number;
}

/** A section charge fed into the evaluator. */
export interface EvaluatorSectionCharge {
  id: string;
  chargeToken: string;           // e.g. SEC_A_PORT_LEVY
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaBase: "BASE" | "TOTAL" | "CHARGES";
  formulaRest: string;           // e.g. " * 0.10"
  sortOrder: number;
}

/** A parent row fed into the evaluator. */
export interface EvaluatorRow {
  id: string;
  rowToken: string;              // e.g. PORT_DUES (= base sum token)
  parentLabel: string;
  sectionId: string;
  /** valueType = 'formula' → evaluate formula; 'normal' → use initialValue/manualValue */
  valueType: import("@starter/db").ComponentValueType;
  /**
   * Stored as {{$row:uuid}} format. Decoded before evaluation.
   * Only present when valueType = 'formula'.
   */
  formula?: string | null;
  /** Pre-fill value (numeric string). Only if valueType = normal. */
  initialValue?: string | null;
  /** Staff-entered override at invoice time. Only if valueType = normal. */
  manualValue?: string | null;
  charges: EvaluatorRowCharge[];
  sortOrder: number;
}

/** A section fed into the evaluator. */
export interface EvaluatorSection {
  id: string;
  sectionToken: string;          // e.g. A, B, PORT_COSTS
  displayName?: string;
  sortOrder: number;
  rows: EvaluatorRow[];
  sectionCharges: EvaluatorSectionCharge[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATED OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Evaluated result for one row charge. */
export interface EvaluatedRowCharge {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaSnapshot: string;
  /** BigNumber serialized as fixed(6) string */
  value: string;
  sortOrder: number;
}

/** Evaluated result for one section charge. */
export interface EvaluatedSectionCharge {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaBase: "BASE" | "TOTAL" | "CHARGES";
  formulaRest: string;
  formulaSnapshot: string;
  /** BigNumber serialized as fixed(6) string */
  value: string;
  sortOrder: number;
}

/** Evaluated result for one parent row. */
export interface EvaluatedRow {
  id: string;
  rowToken: string;
  parentLabel: string;
  sectionToken: string;
  charges: EvaluatedRowCharge[];
  /** The row's own computed value. BigNumber fixed(6) string */
  baseValue: string;
  /** Sum of row charge values. BigNumber fixed(6) string */
  chargesValue: string;
  /** baseValue + chargesValue. BigNumber fixed(6) string */
  totalValue: string;
  sortOrder: number;
}

/** Evaluated result for one section. */
export interface EvaluatedSection {
  id: string;
  sectionToken: string;
  displayName?: string;
  autoName: string;              // letter computed by sortOrder (A, B, C…)
  rows: EvaluatedRow[];
  sectionCharges: EvaluatedSectionCharge[];
  /** BigNumber fixed(6) string */
  sectionBase: string;
  /** BigNumber fixed(6) string */
  sectionChargesTotal: string;
  /** BigNumber fixed(6) string */
  sectionTotal: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EngineErrorCode =
  | "TOKEN_NOT_FOUND"
  | "CIRCULAR_DEPENDENCY"
  | "FORWARD_REFERENCE"
  | "CHARGE_SCOPE_VIOLATION"       // row/section charge refs a forbidden token
  | "DIVISION_BY_ZERO"
  | "EVALUATION_FAILED"
  | "NEGATIVE_VALUE_NOT_ALLOWED"
  | "INVALID_FORMULA_SYNTAX"
  | "SECTION_NOT_FOUND"
  | "DUPLICATE_TOKEN"
  | "REORDER_VIOLATION";           // reorder would break a forward reference

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  /** The token of the row where the error occurred. */
  rowToken?: string;
  /** The unresolved token in the formula. */
  token?: string;
  /** The formula that caused the error. */
  formula?: string;
  details?: Record<string, unknown>;
}

export interface EngineContext {
  [key: string]: string | number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAG VALIDATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal shape the DAG validator needs from a component or charge.
 * Used for building the dependency graph.
 */
export interface DagNode {
  token: string;
  formula?: string;
  /** For charges: the owning row or section token (scope restriction enforcement). */
  ownerToken?: string;
  /** If true, this node may only reference its ownerToken and ownerToken_TOTAL. */
  isCharge?: boolean;
}

export interface DagValidationResult {
  valid: boolean;
  /** Ordered list of tokens in safe evaluation order. */
  topologicalOrder: string[];
  errors: EngineError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW / API TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewPayload {
  projectId: string;
  templateId?: string;
  /** Optional draft override — used when staff are editing an invoice. */
  draftSections?: EvaluatorSection[];
  headerFieldValues?: Record<string, string>;
}

export interface PreviewResponse {
  sections: EvaluatedSection[];
  grandTotal: string;
  resolvedScope: import("@starter/db").ResolvedScopeV2;
  validationErrors: EngineError[];
}
