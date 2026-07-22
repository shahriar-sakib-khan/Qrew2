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
import { AddRowChargeModal } from "./add-row-charge-modal";
import { cn } from "@/lib/utils";
import { TokenMap, fmt, decodeFormula } from "@/lib/formula-evaluator";
import { Badge } from "@/components/ui/badge";
import { useBuilderContext, cellFromRow, cellFromRowCharge } from "./builder-context";

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
  if (!onClick) {
    return (
      <div className={cn("w-full h-full flex items-center justify-end", className)} title="Not editable">
        {children}
      </div>
    );
  }
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
  const { apiBasePath, invalidateKey } = useBuilderContext();

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
        `${apiBasePath}/sections/${sectionId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ parentLabel: trimmed }),
        }
      );
      if (!res.ok) throw new Error("Failed to save label");
      queryClient.invalidateQueries({
        queryKey: invalidateKey,
      });
    } catch {
      toast.error("Failed to save label");
    }
  }, [draft, value, rowId, templateId, sectionId, queryClient]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && setEditing(true)}
      onKeyDown={(e) => e.key === "Enter" && !editing && setEditing(true)}
      className="w-full h-full"
    >
      {editing ? (
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
      ) : (
        <span className={cn("text-sm font-medium text-foreground leading-snug", !value && "text-muted-foreground/30")}>
          {value || "Click to add label…"}
        </span>
      )}
    </div>
  );
}

// ─── Inline charge label cell ──────────────────────────────────────────────────
/**
 * Renders a charge label inline — clicking it activates an in-place input.
 * Saves via PATCH /rows/:rowId with a full-replace charges array.
 */
function ChargeLabelCell({
  charge,
  allCharges,
  rowId,
  sectionId,
}: {
  charge: any;
  allCharges: any[];
  rowId: string;
  sectionId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(charge.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { apiBasePath, invalidateKey } = useBuilderContext();

  useEffect(() => { if (!editing) setDraft(charge.label); }, [charge.label, editing]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === charge.label || !trimmed) return;
    const updatedCharges = allCharges.map((c: any) =>
      c.id === charge.id
        ? { chargeToken: c.chargeToken, label: trimmed, subDescription: c.subDescription ?? null, qualifier: null, tags: c.tags ?? [], formula: c.formula, sortOrder: c.sortOrder }
        : { chargeToken: c.chargeToken, label: c.label, subDescription: c.subDescription ?? null, qualifier: null, tags: c.tags ?? [], formula: c.formula, sortOrder: c.sortOrder }
    );
    try {
      const res = await fetch(`${apiBasePath}/sections/${sectionId}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ charges: updatedCharges }),
      });
      if (!res.ok) throw new Error("Failed to save charge label");
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    } catch {
      toast.error("Failed to save charge label");
    }
  }, [draft, charge, allCharges, rowId, sectionId, apiBasePath, queryClient, invalidateKey]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setDraft(charge.label); setEditing(false); }
        }}
        className={cn(
          "w-full bg-transparent border-none outline-none focus:outline-none text-right",
          "text-sm font-medium text-foreground/80 leading-snug caret-primary",
        )}
        placeholder="Enter label…"
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
      className="text-sm font-medium text-foreground/80 leading-snug hover:text-foreground cursor-text"
    >
      {draft || "Click to label…"}
    </span>
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
  notices,
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
  notices?: any[];
}) {
  const { tokenPoolOpen, selectedCell } = useBuilderContext();
  const isFormulaMode = !!selectedCell;

  const handleTokenClick = (e: React.MouseEvent, clickedToken: string) => {
    e.stopPropagation();
    if (isFormulaMode) {
      window.dispatchEvent(new CustomEvent("insert-token", { detail: clickedToken }));
    } else {
      navigator.clipboard.writeText(clickedToken);
      toast.success("Token copied");
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-stretch border-b border-border group/row",
        "hover:bg-muted/5 transition-colors bg-background",
        notices && notices.length > 0 && "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]",
        className
      )}
      style={style}
    >
      {/* Token — outside the table border via absolute positioning */}
      {token && (
        <div 
          className={cn(
            "absolute right-full top-0 bottom-0 w-36 min-w-[9rem] hover:w-auto flex items-center justify-end pr-3 select-none transition-colors",
            "z-10 hover:z-50 hover:pl-4 rounded-l-md",
            isFormulaMode 
              ? "cursor-pointer text-primary hover:bg-primary/5 hover:border-primary/20" 
              : "cursor-pointer hover:text-foreground hover:bg-muted hover:shadow-sm"
          )}
          onClick={(e) => handleTokenClick(e, token)}
          title={isFormulaMode ? "Insert into formula" : "Copy token"}
        >
          <span className={cn(
            "font-mono text-xs font-semibold truncate leading-none",
            isFormulaMode ? "text-primary/70" : "text-muted-foreground/70"
          )}>
            {token}
          </span>
        </div>
      )}

      {/* Formula — outside the table right border via absolute positioning */}
      {formula && (
        <div className="absolute left-full top-0 bottom-0 w-48 flex items-center justify-start pl-3 select-none pointer-events-none z-10">
          <span className="font-mono text-xs font-semibold text-muted-foreground/70 truncate leading-none bg-muted/40 px-2 py-1 rounded-md" title={`= ${formula}`}>
            = {formula}
          </span>
        </div>
      )}

      {/* SL column */}
      <div 
        className={cn(
          "w-10 shrink-0 flex items-center justify-center border-r border-border text-sm font-bold transition-colors select-none",
          token ? (
            isFormulaMode 
              ? "cursor-pointer text-primary hover:bg-primary/10" 
              : "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/10"
          ) : "text-muted-foreground"
        )}
        onClick={(e) => token && handleTokenClick(e, token)}
        title={token ? (isFormulaMode ? "Insert into formula" : "Copy token") : undefined}
      >
        {sl}
      </div>

      {/* Label column */}
      <div className="flex-1 px-3 py-1.5 flex items-center gap-2 border-r border-border min-w-0 overflow-hidden text-sm md:text-base font-medium">
        {labelContent}
        {notices && notices.length > 0 && <UnresolvedNoticeButton notices={notices} />}
      </div>

      {/* USD1 — base/charge value (left column) */}
      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end border-r border-border",
          "text-base font-bold text-foreground tabular-nums",
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
              <span className="text-muted-foreground/30 text-sm select-none">—</span>
            ) : (
              <span className="text-muted-foreground/30 text-[10px] uppercase tracking-wider select-none">Not editable</span>
            )
          )}
        </ClickableCell>
      </div>

      {/* USD2 — row total (right column) */}
      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end",
          "text-base font-bold text-foreground tabular-nums",
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
              <span className="text-muted-foreground/30 text-sm select-none">—</span>
            ) : (
              <span className="text-muted-foreground/30 text-[10px] uppercase tracking-wider select-none">Not editable</span>
            )
          )}
        </ClickableCell>
      </div>

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

import { TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function UnresolvedNoticeButton({ notices }: { notices: any[] }) {
  const [open, setOpen] = useState(false);
  if (!notices?.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-colors shrink-0"
          title="Validation Warnings"
        >
          <TriangleAlert className="w-2.5 h-2.5 text-amber-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3 border-amber-500/30 shadow-xl z-[100]">
        <div className="flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">Warnings</p>
            <ul className="space-y-1">
              {notices.map((n: any, i: number) => (
                <li key={i} className="text-[11px] font-mono bg-muted/40 rounded px-2 py-1 flex flex-col gap-1">
                  {n.token && <span className="text-amber-300">{n.token}</span>}
                  {n.message && <span className="text-muted-foreground break-words whitespace-pre-wrap">{n.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

// ─── Row charge line ─────────────────────────────────────────────────────────────
/**
 * Sub-row beneath a parent row for an individual charge.
 * - Label is right-aligned and italic (click-to-edit inline).
 * - chargeValue → USD1 (the charge’s own computed amount).
 * - rowTotal    → USD2 (parent row total; pass only on the LAST charge row).
 */
export function RowChargeLine({
  charge,
  sectionColor,
  chargeValue,
  rowTotal,
  onEditCharge,
  onDeleteCharge,
  allCharges,
  rowId,
  sectionId,
  allSections,
  onClickUsd1,
  isUsd1Selected,
}: {
  charge: any;
  sectionColor?: SectionColor;
  chargeValue?: string;
  rowTotal?: string;
  onEditCharge?: () => void;
  onDeleteCharge?: () => void;
  /** All charges on this row — needed for inline label save (full-replace API). */
  allCharges?: any[];
  rowId?: string;
  sectionId?: string;
  allSections?: any[];
  onClickUsd1?: () => void;
  isUsd1Selected?: boolean;
}) {
  return (
    <TableRow
      token={charge.chargeToken}
      formula={allSections && charge.formula ? decodeFormula(charge.formula, allSections) : charge.formula}
      onClickUsd1={onClickUsd1}
      isUsd1Selected={isUsd1Selected}
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
        onEditCharge || onDeleteCharge ? (
          <>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onEditCharge}
              title="Edit row charge"
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
        <div className="flex items-center justify-end gap-1 w-full text-right pr-1">
          {allCharges && rowId && sectionId ? (
            <ChargeLabelCell
              charge={charge}
              allCharges={allCharges}
              rowId={rowId}
              sectionId={sectionId}
            />
          ) : (
            <span className="text-sm text-foreground/60 italic leading-snug">
              {charge.label}
            </span>
          )}
        </div>
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
  onEditCharge,
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
  onEditCharge: (charge: any) => void;
  dragHandleProps?: any;
}) {
  const { selectedCell, setSelectedCell, mode } = useBuilderContext();
  const charges: any[] = row.charges ?? [];
  const hasCharges = charges.length > 0;

  const baseValue  = tokenMap[row.rowToken];
  const totalValue = tokenMap[`${row.rowToken}_TOTAL`];

  // Determine notices for this row.
  // Match ONLY by rowToken — the engine explicitly sets rowToken on every notice
  // so we know exactly which row triggered each warning.
  // Broader string-inclusion matches caused false positives (e.g. ROW1's
  // "ROW2 undefined" notice incorrectly bleeding onto ROW2 itself).
  const { validationErrors } = useBuilderContext();
  const notices = (validationErrors || []).filter(
    (e: any) => e.rowToken === row.rowToken
  );

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
            {mode !== "fill" && (
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/sl:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                {...(dragHandleProps ?? {})}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/60" />
              </div>
            )}
          </div>
        }
        actions={mode !== "fill" ? <RowActions onEdit={onEdit} onDelete={onDelete} onAddCharge={onAddCharge} /> : undefined}
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
        notices={notices}
      />

      {/* Row charges */}
      {charges.map((charge: any, idx: number) => {
        const isLastCharge = idx === charges.length - 1;
        const chargeVal = charge.chargeToken ? tokenMap[charge.chargeToken] : null;
        const displayCharge = chargeVal != null ? fmt(chargeVal) : undefined;

        const chargeDecodedFormula = charge.formula ? decodeFormula(charge.formula, allSections) : undefined;
        const isChargeSelected = selectedCell?.chargeId === charge.id;
        
        return (
          <RowChargeLine
            key={charge.id}
            charge={charge}
            sectionColor={sectionColor}
            chargeValue={displayCharge}
            rowTotal={isLastCharge ? displayTotal : undefined}
            onClickUsd1={() => {
              if (mode !== "fill") {
                setSelectedCell(cellFromRowCharge({ templateId, sectionId, row, charge, decodedFormula: chargeDecodedFormula }));
              }
            }}
            isUsd1Selected={isChargeSelected}
            onEditCharge={mode !== "fill" ? () => onEditCharge(charge) : undefined}
            onDeleteCharge={mode !== "fill" ? () => onDeleteCharge(charge.id) : undefined}
            allCharges={mode !== "fill" ? charges : undefined}
            rowId={mode !== "fill" ? row.id : undefined}
            sectionId={mode !== "fill" ? sectionId : undefined}
            allSections={allSections}
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
  const { apiBasePath, invalidateKey, mode } = useBuilderContext();
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<any>(null);
  const [addingChargeForRow, setAddingChargeForRow] = useState<any>(null);
  const [editingChargeForRow, setEditingChargeForRow] = useState<{row: any, charge: any} | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: invalidateKey });
  };

  // ── Reorder (batch + optimistic update) ──────────────────────────────────
  // onMutate immediately rewrites the cache so the UI shows the new order
  // before the server responds — no flicker when dnd resets the DOM.
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(
        `${apiBasePath}/sections/${sectionId}/rows/reorder`,
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
      await queryClient.cancelQueries({ queryKey: invalidateKey });

      // Snapshot the current cache for rollback on error
      const previousData = queryClient.getQueryData(invalidateKey);

      // Immediately reorder the rows in the cache
      queryClient.setQueryData(invalidateKey, (old: any) => {
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
        queryClient.setQueryData(invalidateKey, context.previousData);
      }
      toast.error("Failed to reorder rows");
    },
    onSettled: () => {
      // Always re-sync with the server to confirm the final state
      invalidate();
    },
  });

  const setPrintableMutation = useMutation({
    mutationFn: async ({ rowId, printable }: { rowId: string, printable: boolean }) => {
      const res = await fetch(
        `${apiBasePath}/sections/${sectionId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isPrintable: printable }),
        }
      );
      if (!res.ok) throw new Error("Failed to update print status");
      return res.json();
    },
    onMutate: async ({ rowId, printable }) => {
      await queryClient.cancelQueries({ queryKey: invalidateKey });
      const previousData = queryClient.getQueryData(invalidateKey);
      queryClient.setQueryData(invalidateKey, (old: any) => {
        if (!old) return old;
        return old.map((section: any) => {
          if (section.id !== sectionId) return section;
          return {
            ...section,
            rows: section.rows.map((r: any) => r.id === rowId ? { ...r, isPrintable: printable } : r)
          };
        });
      });
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(invalidateKey, context.previousData);
      }
      toast.error("Failed to update print status");
    },
    onSettled: () => invalidate(),
  });

  // ── Delete row ────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Are you sure you want to delete this row?")) return;
      const res = await fetch(
        `${apiBasePath}/sections/${sectionId}/rows/${id}`,
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

  // ── Add a single charge — now opens AddRowChargeModal ────────────────────
  // (Removed the silent addChargeMutation; modal handles creation.)

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

  if (mode === "fill") {
    return (
      <div className="flex flex-col bg-background overflow-visible">
        {sortedRows.map((row: any, idx: number) => (
          <div key={row.id} className="overflow-visible">
            <SingleRow
              row={row}
              globalSl={slOffset + idx + 1}
              sectionColor={sectionColor}
              tokenMap={tokenMap}
              templateId={templateId}
              sectionId={sectionId}
              allSections={allSections}
              onEdit={() => {}}
              onDelete={() => {}}
              onAddCharge={() => {}}
              onDeleteCharge={() => {}}
              onEditCharge={() => {}}
              dragHandleProps={{}}
            />
          </div>
        ))}
      </div>
    );
  }

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
                      onAddCharge={() => setAddingChargeForRow(row)}
                      onDeleteCharge={(chargeId) =>
                        deleteChargeMutation.mutate({ rowId: row.id, chargeId })
                      }
                      onEditCharge={(charge) => setEditingChargeForRow({ row, charge })}
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

      {/* Add row charge modal */}
      {(addingChargeForRow || editingChargeForRow) && (
        <AddRowChargeModal
          isOpen={!!addingChargeForRow || !!editingChargeForRow}
          onClose={() => {
            setAddingChargeForRow(null);
            setEditingChargeForRow(null);
          }}
          templateId={templateId}
          sectionId={sectionId}
          rowId={addingChargeForRow?.id || editingChargeForRow?.row.id}
          rowToken={addingChargeForRow?.rowToken || editingChargeForRow?.row.rowToken}
          existingCharges={addingChargeForRow?.charges || editingChargeForRow?.row.charges || []}
          editCharge={editingChargeForRow?.charge}
          onSuccess={() => { invalidate(); setAddingChargeForRow(null); setEditingChargeForRow(null); }}
        />
      )}
    </DragDropContext>
  );
}
