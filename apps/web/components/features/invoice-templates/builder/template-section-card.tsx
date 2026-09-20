"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { AddSectionModal } from "./add-section-modal";
import { TableRow, TemplateRowList, SectionColor } from "./template-row-list";
import { AddEditRowModal } from "./add-edit-row-modal";
import { AddEditSectionChargeModal } from "./add-edit-section-charge-modal";
import { TokenMap, fmt, evaluateFormula } from "@/lib/formula-evaluator";

// ─── Section charge line ──────────────────────────────────────────────────────
// Visually distinct from RowChargeLine:
//   • Uses the section color for left border + background tint
//   • Non-italic, slightly bolder label (vs italic for row charges)
//   • Edit/delete actions wired to dedicated section-charge endpoints
function SectionChargeLine({
  charge,
  sectionToken,
  sectionColor,
  tokenMap,
  onEdit,
  onDelete,
}: {
  charge: any;
  sectionToken: string;
  sectionColor: SectionColor;
  tokenMap: TokenMap;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Reconstruct full formula from formulaBase + formulaRest
  const fullFormula = `SEC_${sectionToken}_${charge.formulaBase ?? ""} ${charge.formulaRest ?? ""}`.trim();
  const computedVal = evaluateFormula(fullFormula, tokenMap);

  return (
    <TableRow
      formula={fullFormula}
      style={{
        backgroundColor: sectionColor.bg,
        borderLeftColor: sectionColor.border,
        borderLeftWidth: 3,
      }}
      actions={
        <>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onEdit} title="Edit section charge">
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Delete section charge">
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      }
      labelContent={
        <span className="text-sm font-medium text-foreground/80 leading-snug w-full text-right pr-1">
          {charge.label}
        </span>
      }
      usd2={computedVal != null ? <span>{fmt(computedVal)}</span> : undefined}
    />
  );
}

// ─── Main section card ────────────────────────────────────────────────────────
export function TemplateSectionCard({
  templateId,
  section,
  allSections,
  isFirst,
  isLast,
  slOffset = 0,
  sectionColor,
  tokenMap,
}: {
  templateId: string;
  section: any;
  allSections: any[];
  isFirst: boolean;
  isLast: boolean;
  slOffset?: number;
  sectionColor: SectionColor;
  tokenMap: TokenMap;
}) {
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [isAddSectionChargeModalOpen, setIsAddSectionChargeModalOpen] = useState(false);
  const [editingSectionCharge, setEditingSectionCharge] = useState<any>(null);

  const displayName = section.displayName ?? null;
  const sectionToken = section.sectionToken;
  const headerName = displayName || sectionToken;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["template-sections", templateId] });
  };

  const reorderMutation = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      const sorted = [...allSections].sort((a, b) => a.sortOrder - b.sortOrder);
      const myIdx = sorted.findIndex((s) => s.id === section.id);
      const neighborIdx = direction === "up" ? myIdx - 1 : myIdx + 1;
      if (neighborIdx < 0 || neighborIdx >= sorted.length) return;
      const neighbor = sorted[neighborIdx];
      await Promise.all([
        fetch(`${apiUrl}/api/invoice-templates/${templateId}/sections/${section.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ orderIndex: neighbor.sortOrder }),
        }),
        fetch(`${apiUrl}/api/invoice-templates/${templateId}/sections/${neighbor.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ orderIndex: section.sortOrder }),
        }),
      ]);
    },
    onSuccess: invalidate,
    onError: () => toast.error("Failed to reorder section"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!confirm(`Delete section "${headerName}" and all its rows and charges?`)) return;
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${section.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to delete section");
      return res.json();
    },
    onSuccess: () => { toast.success("Section deleted"); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSectionChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      if (!confirm("Delete this section charge?")) return;
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${section.id}/section-charges/${chargeId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to delete section charge");
      return res.json();
    },
    onSuccess: () => { toast.success("Section charge deleted"); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const rows: any[] = section.rows ?? [];
  const sectionCharges: any[] = section.sectionCharges ?? [];

  return (
    // overflow-visible is required so the absolute-positioned row tokens (right:100%) can escape the card border
    <div className="flex flex-col group/section overflow-visible">
      {/* ── Section header — thin, muted, full-width, with section color left border */}
      <div className="flex items-stretch border-b border-border bg-muted/20 group/sec">
        <div
          className="flex-1 px-3 py-1.5 flex items-center justify-between min-w-0"
          style={{ borderLeft: `4px solid ${sectionColor.border}` }}
        >
          <div className="flex items-center gap-2">
            {/* Section reorder arrows */}
            <div className="flex flex-col shrink-0 opacity-0 group-hover/sec:opacity-100 transition-opacity">
              <button
                disabled={isFirst || reorderMutation.isPending}
                onClick={() => reorderMutation.mutate("up")}
                className="hover:text-primary disabled:opacity-30 disabled:cursor-default leading-none"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                disabled={isLast || reorderMutation.isPending}
                onClick={() => reorderMutation.mutate("down")}
                className="hover:text-primary disabled:opacity-30 disabled:cursor-default leading-none"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <h3
              className="font-bold text-sm leading-tight truncate"
              style={{ color: sectionColor.border }}
            >
              {displayName || `Section ${sectionToken.split("_").pop()}`}
            </h3>
            {/* Token badge — hover only */}
            <span className="font-mono text-[10px] text-muted-foreground/40 bg-muted/50 px-1.5 rounded opacity-0 group-hover/sec:opacity-100 transition-opacity select-all">
              {sectionToken}
            </span>
          </div>

          {/* Edit / Delete — hover only */}
          <div className="flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setIsEditModalOpen(true)} title="Edit section">
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate()} title="Delete section">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Rows ── */}
      <TemplateRowList
        templateId={templateId}
        sectionId={section.id}
        sectionToken={sectionToken}
        rows={rows}
        isLoading={false}
        slOffset={slOffset}
        sectionColor={sectionColor}
        tokenMap={tokenMap}
        allSections={allSections}
      />

      {/* ── Section charges — visually distinct (section color, bolder) ── */}
      {sectionCharges.length > 0 && (
        <div className="flex flex-col">
          {sectionCharges
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((charge: any) => (
              <SectionChargeLine
                key={charge.id}
                charge={charge}
                sectionToken={sectionToken}
                sectionColor={sectionColor}
                tokenMap={tokenMap}
                onEdit={() => setEditingSectionCharge(charge)}
                onDelete={() => deleteSectionChargeMutation.mutate(charge.id)}
              />
            ))}
        </div>
      )}

      {/* ── Footer — Add row / Add section charge ── */}
      <div className="flex items-stretch border-b border-border bg-muted/5 hover:bg-muted/10 transition-colors">
        {/* Add row button */}
        <div className="flex-1 border-r border-border p-0.5">
          <Button
            variant="ghost" size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20"
            onClick={() => setIsAddRowModalOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Add row
          </Button>
        </div>
        {/* Add section charge button — spans both USD columns */}
        <div className="w-40 shrink-0 p-0.5">
          <Button
            variant="ghost" size="sm"
            className="w-full h-7 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20"
            onClick={() => setIsAddSectionChargeModalOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Add section charge
          </Button>
        </div>
      </div>

      {/* ── Modals ── */}
      <AddSectionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        templateId={templateId}
        editSection={section}
      />

      {isAddRowModalOpen && (
        <AddEditRowModal
          isOpen={isAddRowModalOpen}
          onClose={() => setIsAddRowModalOpen(false)}
          templateId={templateId}
          sectionId={section.id}
          sectionToken={sectionToken}
          onSuccess={invalidate}
        />
      )}

      {(isAddSectionChargeModalOpen || editingSectionCharge) && (
        <AddEditSectionChargeModal
          isOpen={isAddSectionChargeModalOpen || !!editingSectionCharge}
          onClose={() => {
            setIsAddSectionChargeModalOpen(false);
            setEditingSectionCharge(null);
          }}
          templateId={templateId}
          sectionId={section.id}
          sectionToken={sectionToken}
          editCharge={editingSectionCharge}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
