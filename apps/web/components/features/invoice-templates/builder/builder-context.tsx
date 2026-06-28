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
};

// ─── Context ──────────────────────────────────────────────────────────────────

type BuilderContextValue = {
  selectedCell: SelectedCell | null;
  setSelectedCell: (cell: SelectedCell | null) => void;
  /** Live token map — updated by the workspace whenever sections data changes. */
  tokenMap: TokenMap;
  setTokenMap: (map: TokenMap) => void;
  tokenPoolOpen: boolean;
};

const BuilderContext = createContext<BuilderContextValue>({
  selectedCell: null,
  setSelectedCell: () => {},
  tokenMap: {},
  setTokenMap: () => {},
  tokenPoolOpen: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BuilderProvider({
  tokenPoolOpen = false,
  children,
}: {
  tokenPoolOpen?: boolean;
  children: React.ReactNode;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [tokenMap, setTokenMap] = useState<TokenMap>({});

  return (
    <BuilderContext.Provider
      value={{
        selectedCell,
        setSelectedCell,
        tokenMap,
        setTokenMap,
        tokenPoolOpen,
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
    breadcrumb: row.parentLabel || "Untitled Row",
    valueType: isFormula ? "formula" : "normal",
    currentInput: isFormula
      ? `= ${decodedFormula ?? row.formula ?? ""}`
      : String(row.initialValue ?? ""),
  };
}
