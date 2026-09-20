"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { AddEditRowModal } from "./add-edit-row-modal";
import { cn } from "@/lib/utils";
import { TokenMap, fmt, decodeFormula } from "@/lib/formula-evaluator";
import { cellFromRow, useBuilderContext } from "./builder-context";

// ─── Section color type ───────────────────────────────────────────────────────
export type SectionColor = { border: string; bg: string };

// ─── Clickable value cell ─────────────────────────────────────────────────────
function ClickableCell({
  onClick,
  isSelected,
  children,
  className,
}: {
  onClick?: () => void;
  isSelected?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!onClick) return <>{children}</>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "w-full h-full flex items-center justify-end",
        "cursor-pointer rounded-sm transition-all duration-100",
        "hover:ring-1 hover:ring-primary/30 hover:bg-primary/5",
        isSelected && "ring-2 ring-primary/60 bg-primary/8",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Inline label cell ────────────────────────────────────────────────────────
/**
 * Renders the row label inline — clicking it activates an in-place <input>.
 * Saves via PATCH on Enter or blur; Escape cancels.
 */
function LabelCell({
  rowId,
  templateId,
  sectionId,
  value,
}: {
  rowId: string;
  templateId: string;
  sectionId: string;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Sync draft when external value changes (e.g. after save)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === value) return; // no change
    try {
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ parentLabel: trimmed }),
        }
      );
      if (!res.ok) throw new Error("Failed to save label");
      queryClient.invalidateQueries({
        queryKey: ["template-sections", templateId],
      });
    } catch {
      toast.error("Failed to save label");
    }
  }, [draft, value, rowId, templateId, sectionId, queryClient]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={cn(
          "w-full bg-transparent border-none outline-none focus:outline-none",
          "text-sm font-medium text-foreground leading-snug caret-primary",
          "placeholder:text-muted-foreground/40"
        )}
        placeholder="Enter row label…"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit label"
      className={cn(
        "w-full text-left leading-snug cursor-text",
        "text-sm font-medium",
        value
          ? "text-foreground hover:text-foreground/80"
          : "text-muted-foreground/40 italic text-xs hover:text-muted-foreground/60"
      )}
    >
      {value || "click to add label…"}
    </button>
  );
}

// ─── Shared Table Row ─────────────────────────────────────────────────────────
/**
 * Layout (5 visual columns):
 *   [TOKEN — absolute, outside left border] | SL (w-10) | Label (flex-1) | USD1 (w-20) | USD2 (w-20)
 *
 * The token uses position:absolute with right:100% so it appears outside the
 * table's left border. The parent sections container must have overflow:visible.
 *
 * - usd1 = left USD col  (base value for rows-with-charges; charge value for charge rows)
 * - usd2 = right USD col (total — shown for rows-without-charges or on last charge row)
 */
export function TableRow({
  token,
  sl,
  labelContent,
  usd1,
  usd2,
  formula,
  className,
  actions,
  style,
  onClickUsd1,
  onClickUsd2,
  isUsd1Selected,
  isUsd2Selected,
}: {
  token?: string;
  sl?: React.ReactNode;
  labelContent: React.ReactNode;
  usd1?: React.ReactNode;
  usd2?: React.ReactNode;
  formula?: string;
  className?: string;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
  onClickUsd1?: () => void;
  onClickUsd2?: () => void;
  isUsd1Selected?: boolean;
  isUsd2Selected?: boolean;
}) {
  const { tokenPoolOpen } = useBuilderContext();

  return (
    <div
      className={cn(
        "relative flex items-stretch border-b border-border group/row",
        "hover:bg-muted/5 transition-colors bg-background",
        className
      )}
      style={style}
    >
      {/* Token — outside the table border via absolute positioning */}
      {token && (
        <div className="absolute right-full top-0 bottom-0 w-28 flex items-center justify-end pr-2 select-none pointer-events-none">
          <span className="font-mono text-[10px] text-muted-foreground/50 truncate leading-none">
            {token}
          </span>
        </div>
      )}

      {/* SL column */}
      <div className="w-10 shrink-0 flex items-center justify-center border-r border-border text-xs font-semibold text-muted-foreground">
        {sl}
      </div>

      {/* Label column */}
      <div className="flex-1 px-3 py-1.5 flex items-center border-r border-border min-w-0 overflow-hidden">
        {labelContent}
      </div>

      {/* USD1 — base/charge value (left column) */}
      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end border-r border-border",
          "text-sm font-semibold text-foreground tabular-nums",
          onClickUsd1 ? "p-1" : "px-2 py-1"
        )}
      >
        <ClickableCell
          onClick={onClickUsd1}
          isSelected={isUsd1Selected}
          className="px-2"
        >
          {usd1 ?? (
            onClickUsd1 ? (
              <span className="text-muted-foreground/20 text-xs select-none">—</span>
            ) : null
          )}
        </ClickableCell>
      </div>

      {/* USD2 — row total (right column) */}
      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end",
          "text-sm font-semibold text-foreground tabular-nums",
          onClickUsd2 ? "p-1" : "px-2 py-1"
        )}
      >
        <ClickableCell
          onClick={onClickUsd2}
          isSelected={isUsd2Selected}
          className="px-2"
        >
          {usd2 ?? (
            onClickUsd2 ? (
              <span className="text-muted-foreground/20 text-xs select-none">—</span>
            ) : null
          )}
        </ClickableCell>
      </div>

      {/* Formula annotation — right of table, fades on row hover */}
      {formula && (
        <div
          className={cn(
            "absolute left-full top-0 bottom-0 pl-3 items-center",
            "whitespace-nowrap pointer-events-none z-10 select-none",
            "transition-opacity duration-150 group-hover/row:opacity-0",
            tokenPoolOpen ? "hidden xl:flex" : "hidden md:flex"
          )}
        >
          <span className="text-xs text-muted-foreground/50 font-mono">
            = {formula}
          </span>
        </div>
      )}

      {/* Hover action buttons */}
      {actions && (
        <div
          className={cn(
            "absolute inset-y-0 flex items-center gap-0.5",
            "opacity-0 group-hover/row:opacity-100 transition-opacity z-20",
            tokenPoolOpen
              ? "right-1 xl:right-auto xl:left-full xl:pl-3"
              : "right-1 md:right-auto md:left-full md:pl-3"
          )}
        >
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none -left-6",
              tokenPoolOpen ? "xl:hidden" : "md:hidden"
            )}
          />
          <div className="relative flex items-center bg-background rounded-md shadow-sm border border-border/50 px-0.5 py-0.5">
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row action buttons ───────────────────────────────────────────────────────
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";

function RowActions({
  onEdit,
  onDelete,
  onAddCharge,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onAddCharge?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground outline-none"
          title="Options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <Edit2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          Edit Token
        </DropdownMenuItem>
        {onAddCharge && (
          <DropdownMenuItem onClick={onAddCharge} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Add a Charge
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete Row
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Row charge line ──────────────────────────────────────────────────────────
/**
 * Sub-row beneath a parent row for an individual charge.
 * - Label is right-aligned and italic.
 * - chargeValue → USD1 (the charge's own computed amount).
 * - rowTotal    → USD2 (parent row total; pass only on the LAST charge row).
 */
export function RowChargeLine({
  charge,
  sectionColor,
  chargeValue,
  rowTotal,
  onEditParentRow,
  onDeleteCharge,
}: {
  charge: any;
  sectionColor?: SectionColor;
  chargeValue?: string;
  rowTotal?: string;
  onEditParentRow?: () => void;
  onDeleteCharge?: () => void;
}) {
  return (
    <TableRow
      formula={charge.formula}
      style={
        sectionColor
          ? {
              backgroundColor: sectionColor.bg,
              borderLeftColor: sectionColor.border,
              borderLeftWidth: 2,
            }
          : undefined
      }
      actions={
        onEditParentRow || onDeleteCharge ? (
          <>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onEditParentRow}
              title="Edit row (opens parent)"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={onDeleteCharge}
              title="Delete charge"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : undefined
      }
      labelContent={
        <span className="text-sm text-foreground/60 italic w-full text-right pr-1 leading-snug">
          {charge.label}
        </span>
      }
      usd1={chargeValue ? <span>{chargeValue}</span> : undefined}
      usd2={rowTotal   ? <span>{rowTotal}</span>   : undefined}
    />
  );
}

// ─── Single row ───────────────────────────────────────────────────────────────
function SingleRow({
  row,
  globalSl,
  sectionColor,
  tokenMap,
  templateId,
  sectionId,
  allSections,
  onEdit,
  onDelete,
  onAddCharge,
  onDeleteCharge,
  dragHandleProps,
}: {
  row: any;
  globalSl: number;
  sectionColor: SectionColor;
  tokenMap: TokenMap;
  templateId: string;
  sectionId: string;
  allSections: any[];
  onEdit: () => void;
  onDelete: () => void;
  onAddCharge: () => void;
  onDeleteCharge: (chargeId: string) => void;
  dragHandleProps?: any;
}) {
  const { selectedCell, setSelectedCell } = useBuilderContext();
  const charges: any[] = row.charges ?? [];
  const hasCharges = charges.length > 0;

  const baseValue  = tokenMap[row.rowToken];
  const totalValue = tokenMap[`${row.rowToken}_TOTAL`];
  const displayBase  = baseValue  != null ? fmt(baseValue)  : undefined;
  const displayTotal = totalValue != null ? fmt(totalValue) : undefined;

  const isSelected = selectedCell?.rowId === row.id;

  const decodedFormula = row.valueType === "formula" ? decodeFormula(row.formula, allSections) : undefined;

  const handleValueClick = () =>
    setSelectedCell(cellFromRow({ templateId, sectionId, row, decodedFormula }));

  const formulaAnnotation = decodedFormula;

  return (
    <>
      <TableRow
        token={row.rowToken}
        sl={
          <div className="group/sl relative flex items-center justify-center w-full h-full min-h-[32px]">
            <span className="group-hover/sl:opacity-0 transition-opacity text-xs font-semibold text-muted-foreground select-none">
              {globalSl}
            </span>
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/sl:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              {...(dragHandleProps ?? {})}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>
        }
        actions={<RowActions onEdit={onEdit} onDelete={onDelete} onAddCharge={onAddCharge} />}
        formula={formulaAnnotation}
        labelContent={
          <LabelCell
            rowId={row.id}
            templateId={templateId}
            sectionId={sectionId}
            value={row.parentLabel ?? ""}
          />
        }
        // No charges → value in USD2 (clickable total)
        // Has charges → base in USD1 (clickable)
        onClickUsd1={hasCharges  ? handleValueClick : undefined}
        onClickUsd2={!hasCharges ? handleValueClick : undefined}
        isUsd1Selected={hasCharges  && isSelected}
        isUsd2Selected={!hasCharges && isSelected}
        usd1={hasCharges  && displayBase  ? <span>{displayBase}</span>  : undefined}
        usd2={!hasCharges && displayTotal ? <span>{displayTotal}</span> : undefined}
      />

      {/* Row charges */}
      {charges.map((charge: any, idx: number) => {
        const isLastCharge = idx === charges.length - 1;
        const chargeVal = charge.chargeToken ? tokenMap[charge.chargeToken] : null;
        const displayCharge = chargeVal != null ? fmt(chargeVal) : undefined;

        return (
          <RowChargeLine
            key={charge.id}
            charge={charge}
            sectionColor={sectionColor}
            chargeValue={displayCharge}
            rowTotal={isLastCharge ? displayTotal : undefined}
            onEditParentRow={onEdit}
            onDeleteCharge={() => onDeleteCharge(charge.id)}
          />
        );
      })}
    </>
  );
}

// ─── Row list ─────────────────────────────────────────────────────────────────
export function TemplateRowList({
  templateId,
  sectionId,
  sectionToken,
  rows,
  isLoading,
  slOffset = 0,
  sectionColor,
  tokenMap,
  allSections,
}: {
  templateId: string;
  sectionId: string;
  sectionToken: string;
  rows?: any[];
  isLoading?: boolean;
  slOffset?: number;
  sectionColor: SectionColor;
  tokenMap: TokenMap;
  allSections: any[];
}) {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<any>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["template-sections", templateId] });
  };

  // ── Reorder (batch + optimistic update) ──────────────────────────────────
  // onMutate immediately rewrites the cache so the UI shows the new order
  // before the server responds — no flicker when dnd resets the DOM.
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/rows/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderedIds }),
        }
      );
      if (!res.ok) throw new Error("Failed to reorder");
      return res.json();
    },
    onMutate: async (orderedIds) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["template-sections", templateId] });

      // Snapshot the current cache for rollback on error
      const previousData = queryClient.getQueryData(["template-sections", templateId]);

      // Immediately reorder the rows in the cache
      queryClient.setQueryData(["template-sections", templateId], (old: any) => {
        if (!old) return old;
        return old.map((section: any) => {
          if (section.id !== sectionId) return section;
          const rowById: Record<string, any> = Object.fromEntries(
            (section.rows ?? []).map((r: any) => [r.id, r])
          );
          const reorderedRows = orderedIds
            .map((id, i) => (rowById[id] ? { ...rowById[id], sortOrder: i } : null))
            .filter(Boolean);
          return { ...section, rows: reorderedRows };
        });
      });

      return { previousData };
    },
    onError: (_err, _ids, context: any) => {
      // Roll back to the snapshot on failure
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["template-sections", templateId], context.previousData);
      }
      toast.error("Failed to reorder rows");
    },
    onSettled: () => {
      // Always re-sync with the server to confirm the final state
      invalidate();
    },
  });


  // ── Delete row ────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Delete this row and all its charges?")) return;
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/rows/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to delete row");
      return res.json();
    },
    onSuccess: () => { toast.success("Row deleted"); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Delete a single charge ─────────────────────────────────────────────────
  const deleteChargeMutation = useMutation({
    mutationFn: async ({ rowId, chargeId }: { rowId: string; chargeId: string }) => {
      const row = sortedRows.find((r: any) => r.id === rowId);
      if (!row) throw new Error("Row not found");
      const remainingCharges = (row.charges ?? [])
        .filter((c: any) => c.id !== chargeId)
        .map((c: any, i: number) => ({
          label: c.label,
          subDescription: c.subDescription,
          qualifier: null,
          tags: c.tags ?? [],
          formula: c.formula,
          sortOrder: i,
        }));
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ charges: remainingCharges }),
        }
      );
      if (!res.ok) throw new Error("Failed to delete charge");
      return res.json();
    },
    onSuccess: () => { toast.success("Charge deleted"); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Add a single charge ────────────────────────────────────────────────────
  const addChargeMutation = useMutation({
    mutationFn: async (rowId: string) => {
      const row = sortedRows.find((r: any) => r.id === rowId);
      if (!row) throw new Error("Row not found");
      const existingCharges = (row.charges ?? []).map((c: any, i: number) => ({
        id: c.id,
        label: c.label,
        subDescription: c.subDescription,
        qualifier: null,
        tags: c.tags ?? [],
        formula: c.formula,
        sortOrder: c.sortOrder ?? i,
      }));
      const newCharge = {
        label: "New Charge",
        subDescription: "",
        formula: `${row.rowToken}_TOTAL * `,
        sortOrder: existingCharges.length,
      };
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ charges: [...existingCharges, newCharge] }),
        }
      );
      if (!res.ok) throw new Error("Failed to add charge");
      return res.json();
    },
    onSuccess: () => { toast.success("Charge added"); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const sortedRows = [...(rows || [])].sort(
    (a: any, b: any) => a.sortOrder - b.sortOrder
  );

  if (sortedRows.length === 0) return null;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;
    if (srcIdx === dstIdx) return;

    // Build the new order by moving the dragged item to its destination
    const newOrder = [...sortedRows];
    const [moved] = newOrder.splice(srcIdx, 1);
    newOrder.splice(dstIdx, 0, moved);

    // Optimistically update the UI immediately (React Query will reconcile on success)
    // Send the full ordered list so the backend assigns unambiguous sortOrders 0, 1, 2...
    reorderMutation.mutate(newOrder.map((r: any) => r.id));
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* overflow-visible is critical so the absolutely-positioned token text can escape the section card border */}
      <Droppable droppableId={`rows-${sectionId}`}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col bg-background overflow-visible"
          >
            {sortedRows.map((row: any, idx: number) => (
              <Draggable key={row.id} draggableId={row.id} index={idx}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="overflow-visible"
                  >
                    <SingleRow
                      row={row}
                      globalSl={slOffset + idx + 1}
                      sectionColor={sectionColor}
                      tokenMap={tokenMap}
                      templateId={templateId}
                      sectionId={sectionId}
                      allSections={allSections}
                      onEdit={() => setEditingRow(row)}
                      onDelete={() => deleteMutation.mutate(row.id)}
                      onAddCharge={() => addChargeMutation.mutate(row.id)}
                      onDeleteCharge={(chargeId) =>
                        deleteChargeMutation.mutate({ rowId: row.id, chargeId })
                      }
                      dragHandleProps={provided.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Edit row modal */}
      {editingRow && (
        <AddEditRowModal
          isOpen={!!editingRow}
          onClose={() => setEditingRow(null)}
          templateId={templateId}
          sectionId={sectionId}
          sectionToken={sectionToken}
          editRow={editingRow}
          onSuccess={() => { invalidate(); setEditingRow(null); }}
        />
      )}
    </DragDropContext>
  );
}
