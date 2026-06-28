/**
 * Invoice Engine — JSONB TypeScript Interfaces (Schema Version 2.0)
 *
 * These are the canonical hand-written interfaces.
 * All JSONB columns must use exactly these shapes.
 *
 * NOTE: The full implementation lives in apps/api/src/features/invoices/engine/types.ts
 * This file re-exports them so database-layer code can import them without
 * creating a dependency on the API package.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROW / COMPONENT VALUE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether the value is manually entered (normal) or formula-computed (formula).
 * Replaces the old RowType enum for computation purposes.
 */
export type ComponentValueType = "normal" | "formula";

/** Frozen line discriminator — used in invoice_line_items.lineType */
export type LineType =
  | "row"             // parent row summary line
  | "row_component"   // sub-value within a multi-value row
  | "row_charge"      // charge bound to a row
  | "section_charge"  // charge bound to a section
  | "grand_total";    // system-generated grand total line

export type HeaderFieldType = "file_field" | "org_constant" | "manual";

// ─────────────────────────────────────────────────────────────────────────────
// HISTORICAL FORMAT V2 — frozen snapshot stored in invoices.historical_format
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoricalFormatV2 {
  schemaVersion: "2.0";
  templateId: string;
  templateVersion: number;
  templateName: string;
  sections: Array<HistoricalSectionV2>;
  headerFields: Array<{
    id: string;
    fieldType: HeaderFieldType;
    label: string;
    fileFieldKey?: string;
    orgConfigKey?: string;
    columnPosition: "left" | "right";
    sortOrder: number;
  }>;
}

export interface HistoricalSectionV2 {
  id: string;
  sectionToken: string;
  displayName?: string;
  /** Auto-letter (A, B, C…) computed at freeze time if no displayName. */
  autoName: string;
  sortOrder: number;
  rows: HistoricalRowV2[];
  sectionCharges: HistoricalSectionChargeV2[];
  /** SEC_X_BASE computed at freeze time */
  sectionBase: string;
  /** SEC_X_CHARGES computed at freeze time */
  sectionChargesTotal: string;
  /** SEC_X_TOTAL computed at freeze time */
  sectionTotal: string;
}

export interface HistoricalRowV2 {
  id: string;
  rowToken: string;
  parentLabel: string;
  sortOrder: number;
  components: HistoricalComponentV2[];
  charges: HistoricalRowChargeV2[];
  /** Sum of component values (no charges). */
  baseValue: string;
  /** Sum of row charge values. */
  chargesValue: string;
  /** baseValue + chargesValue */
  totalValue: string;
}

export interface HistoricalComponentV2 {
  id: string;
  componentToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  valueType: ComponentValueType;
  formulaSnapshot?: string;
  value: string; // BigNumber as string
  sortOrder: number;
}

export interface HistoricalRowChargeV2 {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaSnapshot: string;
  value: string; // BigNumber as string
  sortOrder: number;
}

export interface HistoricalSectionChargeV2 {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaBase: "BASE" | "TOTAL" | "CHARGES";
  formulaRest: string;
  formulaSnapshot: string;
  value: string; // BigNumber as string
  sortOrder: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVED SCOPE V2 — frozen scope map stored in invoices.resolved_scope
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedScopeV2 {
  schemaVersion: "2.0";
  resolvedAt: string; // ISO timestamp
  projectId: string;
  /** All token → BigNumber(string) pairs that were in scope at freeze time. */
  tokens: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT TYPES — used when staff are working on an invoice before freeze
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftSectionV2 {
  id: string;
  sectionToken: string;
  displayName?: string;
  sortOrder: number;
  rows: DraftRowV2[];
  sectionCharges: DraftSectionChargeV2[];
}

export interface DraftRowV2 {
  id: string;
  rowToken: string;
  parentLabel: string;
  sortOrder: number;
  components: DraftComponentV2[];
  charges: DraftRowChargeV2[];
}

export interface DraftComponentV2 {
  id: string;
  componentToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  valueType: ComponentValueType;
  formula?: string;
  /** Staff override for a normal component. */
  manualValue?: string;
  /** Template-configured initial value (pre-fill). */
  initialValue?: string;
  sortOrder: number;
}

export interface DraftRowChargeV2 {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formula: string;
  sortOrder: number;
}

export interface DraftSectionChargeV2 {
  id: string;
  chargeToken: string;
  label: string;
  subDescription?: string;
  qualifier?: string;
  tags?: string[];
  formulaBase: "BASE" | "TOTAL" | "CHARGES";
  formulaRest: string;
  sortOrder: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — bank details, extra sections, footer (unchanged from V1)
// ─────────────────────────────────────────────────────────────────────────────

export interface BankDetailsV1 {
  companyName: string;
  companyAddress?: string;
  accountNo: string;
  bankName: string;
  bankBIC: string;
  bankBranch?: string;
  bankAddress?: string;
  intermediaryBankName?: string;
  intermediaryAccountNo?: string;
  intermediaryBIC?: string;
}

export interface ExtraSectionV1 {
  id: string;
  title: string;
  rows: Array<{ label: string; value: string }>;
}

export interface FooterBlockV1 {
  id: string;
  type: "text" | "address" | "contact_line";
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPAT ALIAS — keep consuming code compiling during migration
// ─────────────────────────────────────────────────────────────────────────────
/** @deprecated Use HistoricalFormatV2 */
export type HistoricalFormatV1 = HistoricalFormatV2;
/** @deprecated Use ResolvedScopeV2 */
export type ResolvedScopeV1 = ResolvedScopeV2;
/** @deprecated Use DraftRowV2 */
export type DraftRowV1 = DraftRowV2;
/** @deprecated Use DraftSectionV2 */
export type DraftSectionV1 = DraftSectionV2;
