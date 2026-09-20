"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type SelectedCell, useBuilderContext } from "./builder-context";
import { preprocessForSave } from "./formula-bar-utils";

export function useSaveCellMutation() {
  const queryClient = useQueryClient();
  const { setSelectedCell, apiBasePath, invalidateKey } = useBuilderContext();

  return useMutation({
    mutationFn: async ({ cell, rawInput }: { cell: SelectedCell; rawInput: string }) => {
      const trimmed = rawInput.trim();

      // A formula contains letters (tokens) or the // or % operators
      const isFormula =
        /[A-Z_]/.test(trimmed) ||
        trimmed.includes("//") ||
        // % after a number = percentage (always a formula), bare % = modulo
        (trimmed.includes("%") && !/^\s*[\d.]+\s*$/.test(trimmed));

      const processedFormula = isFormula ? preprocessForSave(trimmed) : trimmed;

      // ── Section Charge ──
      if (cell.isSectionCharge && cell.chargeId) {
        const res = await fetch(
          `${apiBasePath}/sections/${cell.sectionId}/section-charges/${cell.chargeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ formula: processedFormula }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save section charge");
        }
        return { json: await res.json(), templateId: cell.templateId };
      }

      // ── Row Charge ──
      if (cell.chargeId && cell.row) {
        const res = await fetch(
          `${apiBasePath}/sections/${cell.sectionId}/rows/${cell.rowId}/charges/${cell.chargeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ formula: processedFormula }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save row charge formula");
        }
        return { json: await res.json(), templateId: cell.templateId };
      }

      // ── Normal Row ──
      const payload: Record<string, any> = {
        valueType: isFormula ? "formula" : "normal",
        formula: isFormula ? processedFormula : null,
        initialValue: isFormula ? null : parseFloat(trimmed) || null,
      };

      const res = await fetch(`${apiBasePath}/sections/${cell.sectionId}/rows/${cell.rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      return { json: await res.json(), templateId: cell.templateId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setSelectedCell(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save cell value"),
  });
}
