"use client";

import { createContext, useContext, useState } from "react";
import type { TokenMap } from "@/lib/formula-evaluator";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A "selected cell" is the value cell of a row in the table.
 * Clicking the value cell opens the formula bar for editing.
 */
export type SelectedCell = {
  // ── Routing ───────────────────────────────────────────────────────────────
  templateId: string;
  sectionId: string;
  rowId: string;
  /** Full row object — needed to PATCH the row atomically. */
  row: any;
  /** Charge ID if this cell represents a charge. */
  chargeId?: string;
  /** True if this is a section charge (has no parent row). */
  isSectionCharge?: boolean;

  // ── Display ───────────────────────────────────────────────────────────────
  /** Human-readable breadcrumb shown on the left side of the formula bar.
   *  e.g. "Port Dues" */
  breadcrumb: string;

  // ── Current value ─────────────────────────────────────────────────────────
  /** 'normal' → initialValue field.  'formula' → formula field. */
  valueType: "normal" | "formula";
  /**
   * What shows in the formula bar input:
   *  - normal type: "1000"
   *  - formula type: "= PORT_DUES * 0.1"  (leading = is cosmetic)
   */
  currentInput: string;
  /** The token of the specific cell being edited (used to prevent self-referencing) */
  token?: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────

type BuilderContextValue = {
  selectedCell: SelectedCell | null;
  setSelectedCell: (cell: SelectedCell | null) => void;
  /** Live token map — updated by the workspace whenever sections data changes. */
  tokenMap: TokenMap;
  setTokenMap: (map: TokenMap) => void;
  sections: any[];
  setSections?: (sections: any[]) => void;
  tokenPoolOpen: boolean;
  apiBasePath: string;
  mode: "template" | "draft" | "preview" | "fill";
  invalidateKey: readonly string[];
  validationErrors?: any[];
};

const BuilderContext = createContext<BuilderContextValue>({
  selectedCell: null,
  setSelectedCell: () => {},
  tokenMap: {},
  setTokenMap: () => {},
  sections: [],
  tokenPoolOpen: false,
  apiBasePath: "",
  mode: "template",
  invalidateKey: [],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BuilderProvider({
  tokenPoolOpen = false,
  apiBasePath,
  mode = "template",
  invalidateKey,
  validationErrors = [],
  children,
}: {
  templateId?: string;
  draftId?: string;
  tokenPoolOpen?: boolean;
  apiBasePath: string;
  mode?: "template" | "draft" | "preview" | "fill";
  invalidateKey: readonly string[];
  validationErrors?: any[];
  children: React.ReactNode;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [tokenMap, setTokenMap] = useState<TokenMap>({});
  const [sections, setSections] = useState<any[]>([]);

  return (
    <BuilderContext.Provider
      value={{
        selectedCell,
        setSelectedCell,
        tokenMap,
        setTokenMap,
        sections,
        setSections,
        tokenPoolOpen,
        apiBasePath,
        mode,
        invalidateKey,
        validationErrors,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBuilderContext(): BuilderContextValue {
  return useContext(BuilderContext);
}

// ─── Helper — build SelectedCell from a row ───────────────────────────────────

export function cellFromRow({
  templateId,
  sectionId,
  row,
  decodedFormula,
}: {
  templateId: string;
  sectionId: string;
  row: any;
  decodedFormula?: string;
}): SelectedCell {
  const isFormula = row.valueType === "formula";

  return {
    templateId,
    sectionId,
    rowId: row.id,
    row,
    token: row.rowToken,
    breadcrumb: row.label || "Untitled Row",
    valueType: isFormula ? "formula" : "normal",
    currentInput: isFormula
      ? `${decodedFormula ?? row.formula ?? ""}`
      : String(row.initialValue ?? ""),
  };
}

export function cellFromRowCharge({
  templateId,
  sectionId,
  row,
  charge,
  decodedFormula,
}: {
  templateId: string;
  sectionId: string;
  row: any;
  charge: any;
  decodedFormula?: string;
}): SelectedCell {
  return {
    templateId,
    sectionId,
    rowId: row.id,
    row,
    chargeId: charge.id,
    token: charge.chargeToken,
    breadcrumb: charge.label || "Untitled Charge",
    valueType: "formula",
    currentInput: `${decodedFormula ?? charge.formula ?? ""}`,
  };
}

export function cellFromSectionCharge({
  templateId,
  sectionId,
  charge,
  sectionToken,
}: {
  templateId: string;
  sectionId: string;
  charge: any;
  sectionToken: string;
}): SelectedCell {
  return {
    templateId,
    sectionId,
    rowId: "", // Not attached to a row
    row: null,
    chargeId: charge.id,
    isSectionCharge: true,
    token: charge.chargeToken,
    breadcrumb: charge.label || "Untitled Section Charge",
    valueType: "formula",
    currentInput: `${charge.formula ?? ""}`,
  };
}
