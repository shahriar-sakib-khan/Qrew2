"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X } from "lucide-react";
import { TemplateSectionCard } from "./template-section-card";
import { SectionColor } from "./template-row-list";
import { useState } from "react";
import { AddSectionModal } from "./add-section-modal";
import { buildTokenMap, fmt } from "@/lib/formula-evaluator";
import { BuilderProvider, useBuilderContext } from "./builder-context";
import { TemplateFormulaBar } from "./template-formula-bar";
import { toast } from "sonner";
import { AddHeaderFieldModal } from "./add-header-field-modal";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Section color palette ────────────────────────────────────────────────────
export const SECTION_PALETTE: SectionColor[] = [
  { border: "#22c55e", bg: "rgba(34,197,94,0.05)"  },  // green
  { border: "#3b82f6", bg: "rgba(59,130,246,0.05)" },  // blue
  { border: "#f59e0b", bg: "rgba(245,158,11,0.05)" },  // amber
  { border: "#a855f7", bg: "rgba(168,85,247,0.05)" },  // purple
  { border: "#ef4444", bg: "rgba(239,68,68,0.05)"  },  // red
  { border: "#14b8a6", bg: "rgba(20,184,166,0.05)" },  // teal
  { border: "#f97316", bg: "rgba(249,115,22,0.05)" },  // orange
  { border: "#ec4899", bg: "rgba(236,72,153,0.05)" },  // pink
];



// ─── "Add section here" divider ───────────────────────────────────────────────
function AddSectionDivider({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative flex items-center justify-center h-7 group">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border group-hover:bg-primary/30 transition-colors" />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative z-10 inline-flex items-center gap-1 px-3 h-5 rounded-full text-[11px] font-medium",
          "border border-dashed border-border bg-background text-muted-foreground",
          "hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all duration-150",
          "shadow-sm"
        )}
      >
        <Plus className="h-2.5 w-2.5" />
        Add section here
      </button>
    </div>
  );
}

// ─── Table header row ─────────────────────────────────────────────────────────
// 4 columns: SL (w-10) | Label (flex-1) | USD (w-20) | USD (w-20)
// The token area is outside the table (absolute-positioned per row), so NO token space here.
function TableHeaderRow() {
  return (
    <div className="flex items-stretch border border-b-0 border-border bg-muted/40 h-10">
      {/* SL */}
      <div className="w-10 shrink-0 flex items-center justify-center border-r border-border text-sm font-extrabold text-foreground/60">
        SL
      </div>
      {/* Label */}
      <div className="flex-1 px-3 flex items-center gap-2 border-r border-border min-w-0">
        <span className="text-sm font-extrabold text-foreground/60">Row Label</span>
        <span className="text-sm text-foreground/40">(text displayed in PDF)</span>
      </div>
      {/* USD1 — base/charge values */}
      <div className="w-20 shrink-0 flex items-center justify-center border-r border-border text-sm font-extrabold text-foreground/60">
        USD
      </div>
      {/* USD2 — row totals */}
      <div className="w-20 shrink-0 flex items-center justify-center text-sm font-extrabold text-foreground/60">
        USD
      </div>
    </div>
  );
}

// ─── Grand total row ──────────────────────────────────────────────────────────
// Totals in USD2 (right column). No token space (tokens are absolute per-row).
function GrandTotalRow({ total }: { total: number | null }) {
  return (
    <div className="flex items-stretch border border-t-2 border-t-foreground/30 border-border bg-muted/10 h-12">
      {/* SL empty */}
      <div className="w-10 shrink-0 border-r border-border" />
      {/* Label — "Total" right-aligned */}
      <div className="flex-1 px-3 flex items-center justify-end border-r border-border min-w-0">
        <span className="text-base font-extrabold text-foreground uppercase tracking-wide">Total</span>
      </div>
      {/* USD1 — blank */}
      <div className="w-20 shrink-0 border-r border-border" />
      {/* USD2 — grand total */}
      <div className="w-20 shrink-0 flex items-center justify-end px-3">
        <span className="text-base font-extrabold text-foreground tabular-nums">
          {total != null ? fmt(total) : "—"}
        </span>
      </div>
    </div>
  );
}

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";

export interface FileDetailsHeaderBoxProps {
  templateHeaderFields?: Array<{
    id: string;
    label: string;
    fileFieldKey: string;
    fieldType: string;
  }>;
  project?: any; // The actual project data to populate values
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  onReorder?: (newOrder: any[]) => void;
  isTemplateMode?: boolean;
}

export function FileDetailsHeaderBox({ 
  templateHeaderFields = [], 
  project, 
  onDelete, 
  onAdd, 
  onReorder,
  isTemplateMode = false, 
  zoomLevel = 0 
}: FileDetailsHeaderBoxProps & { zoomLevel?: number }) {
  const { selectedCell } = useBuilderContext();
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

  const renderVal = (field: any) => {
    if (!project) return <span className="text-foreground/20 font-light">—</span>;
    
    let val: any = "—";
    if (field.fileFieldKey === "clientId") {
       val = project.client?.name || "—";
    } else if (field.fileFieldKey === "name") {
       val = project.name || "—";
    } else if (field.fileFieldKey === "status") {
       // project.status is a FK to projectStatuses.id (UUID) — resolve the name
       val = project.statusRelation?.name || project.status || "—";
    } else if (project.customFields) {
       val = project.customFields[field.fileFieldKey] ?? "—";
    }

    if (val === "—" || val === null || val === undefined) {
      return <span className="text-foreground/20 font-light">—</span>;
    }
    return val;
  };

  const renderFieldRow = (field: any) => {
    const isSelectable = field.isFormulaInjectable;
    
    return (
      <div className="flex justify-between items-center group relative h-6 w-full">
        <div 
          className={cn(
            "flex gap-2 w-full items-center",
            isSelectable && "transition-colors select-none",
            isSelectable && isFormulaMode && "cursor-pointer text-primary hover:bg-primary/5 rounded-md -ml-1 pl-1",
            isSelectable && !isFormulaMode && "cursor-pointer hover:text-foreground hover:bg-muted/10 rounded-md -ml-1 pl-1"
          )}
          onClick={(e) => isSelectable && field.fileFieldKey && handleTokenClick(e, field.fileFieldKey)}
          title={isSelectable ? (isFormulaMode ? "Insert into formula" : "Copy token") : undefined}
        >
          <span 
            className={cn(
              "font-semibold uppercase tracking-widest w-28 shrink-0 truncate",
              isSelectable && isFormulaMode ? "text-primary/70" : "text-muted-foreground"
            )}
            style={{ fontSize: 12 + zoomLevel }}
          >
            {field.label}
          </span>
          <span className="text-muted-foreground/40 shrink-0">:</span>
          <span 
            className="font-medium truncate"
            style={{ fontSize: 14 + zoomLevel }}
          >
            {renderVal(field)}
          </span>
        </div>
      {isTemplateMode && onDelete && (
        <button
          onClick={() => onDelete(field.id)}
          className="opacity-0 group-hover:opacity-100 absolute -right-4 p-1 text-muted-foreground hover:text-destructive transition-all"
          title="Remove field from template"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onReorder) return;
    const items = Array.from(templateHeaderFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorder(items);
  };

  return (
    <div className="relative group mt-3">
      <div className="border border-border rounded-lg bg-card shadow-sm px-6 py-5">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="header-fields" direction="horizontal">
            {(provided) => (
              <div 
                className="grid grid-cols-2 gap-x-12 gap-y-4"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {templateHeaderFields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index} isDragDisabled={!isTemplateMode || !onReorder}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          ...provided.draggableProps.style,
                        }}
                        className={cn(
                          "flex items-center gap-2",
                          snapshot.isDragging && "bg-card shadow-md z-10 p-1 -m-1 rounded-md border border-primary/20"
                        )}
                      >
                        {isTemplateMode && onReorder && (
                          <div {...provided.dragHandleProps} className="text-muted-foreground/30 hover:text-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
                        {renderFieldRow(field)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      
      {isTemplateMode && onAdd && (
        <button
          onClick={onAdd}
          className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border shadow-sm rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Add a field to template description"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Inner workspace (inside BuilderProvider) ─────────────────────────────────

function WorkspaceInner({ templateId, draftId, zoomLevel = 0, project }: { templateId?: string, draftId?: string, zoomLevel?: number, project?: any }) {
  const { setTokenMap, tokenPoolOpen, apiBasePath, invalidateKey, mode } = useBuilderContext();
  const queryClient = useQueryClient();
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const [isAddHeaderModalOpen, setIsAddHeaderModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenModal = () => setIsAddHeaderModalOpen(true);
    window.addEventListener("open-add-header-field-modal", handleOpenModal);
    return () => window.removeEventListener("open-add-header-field-modal", handleOpenModal);
  }, []);

  const { data: sections, isLoading } = useQuery({
    queryKey: invalidateKey,
    queryFn: async () => {
      const res = await fetch(
        `${apiBasePath}/sections`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
  });

  const { data: templateHeaderFields, refetch: refetchHeaderFields } = useQuery({
    queryKey: ["template-header-fields", templateId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-templates/${templateId}/header-fields`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!templateId,
  });

  const { data: projectCustomFields } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl}/api/workspaces/custom-fields?entityType=project`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Fetch constants (template constants for template mode, draft constants key fed through same endpoint for draft mode) ──
  const constantsQueryKey = draftId
    ? ["draft-constants", draftId]
    : ["template-constants", templateId];
  const constantsUrl = draftId
    ? `${apiUrl}/api/invoices/drafts/${draftId}/constants`
    : `${apiUrl}/api/invoice-templates/${templateId}/constants`;
  const { data: constantsData } = useQuery({
    queryKey: constantsQueryKey,
    queryFn: async () => {
      const res = await fetch(constantsUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(draftId || templateId),
  });

  const sortedSections = [...(sections || [])].sort(
    (a: any, b: any) => a.sortOrder - b.sortOrder
  );

  // ── Compute token map and push it to context ──────────────────────────────
  // Pass constants so formula rows that reference L11, etc. resolve correctly
  const tokenMap = buildTokenMap(sortedSections, undefined, constantsData ?? []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setTokenMap(tokenMap); }, [JSON.stringify(tokenMap)]);

  // ── Global SL offsets ─────────────────────────────────────────────────────
  const sectionSlOffsets: number[] = [];
  let globalCounter = 0;
  for (const sec of sortedSections) {
    sectionSlOffsets.push(globalCounter);
    globalCounter += (sec.rows ?? []).length;
  }

  // ── Grand total ───────────────────────────────────────────────────────────
  const grandTotal = sortedSections.length > 0
    ? sortedSections.reduce((sum: number, sec: any) => {
        const v = tokenMap[`SEC_${sec.sectionToken}_TOTAL`];
        return sum + (v ?? 0);
      }, 0)
    : null;

  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return;
    try {
      await fetch(`${apiUrl}/api/invoice-templates/${templateId}/header-fields/${fieldToDelete}`, {
        method: "DELETE",
        credentials: "include",
      });
      refetchHeaderFields();
    } catch (error) {
      console.error("Failed to delete header field", error);
    } finally {
      setFieldToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto w-full space-y-1">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  return (
    // Extra left padding to give the outside-border token (w-28 = 112px) space to render.
    // overflow-visible is required so absolute-positioned tokens escape the container border.
    <div
      className={cn(
        "px-2 sm:px-4 max-w-5xl mx-auto w-full pb-6 overflow-visible transition-all duration-200",
        tokenPoolOpen
          ? "xl:pl-36 xl:pr-32 2xl:pl-40 2xl:pr-52"
          : "md:pl-36 md:pr-32 lg:pl-40 lg:pr-52"
      )}
    >
      {/* ── File Details Header Box ── */}
      <FileDetailsHeaderBox 
        templateHeaderFields={templateHeaderFields || []} 
        project={project}
        zoomLevel={zoomLevel} 
        isTemplateMode={!draftId}
        onDelete={(fieldId) => setFieldToDelete(fieldId)}
        onReorder={async (newOrder) => {
          if (draftId) return;
          queryClient.setQueryData(["template-header-fields", templateId], newOrder);
          try {
            await fetch(`${apiUrl}/api/invoice-templates/${templateId}/header-fields/reorder`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ fieldIds: newOrder.map((f: any) => f.id) })
            });
            refetchHeaderFields();
          } catch (e) {
            console.error(e);
            refetchHeaderFields();
          }
        }}
        onAdd={() => {
          window.dispatchEvent(new CustomEvent("open-add-header-field-modal"));
        }}
      />

      {/* ── Sticky formula bar ── */}
      <div className="sticky top-0 z-30 pt-6">
        <TemplateFormulaBar />
      </div>

      {/* ── Table header ── */}
      <TableHeaderRow />

      {/* ── Sections ── */}
      {/* overflow-visible is REQUIRED so row tokens (position:absolute right:100%) escape the border */}
      <div className="border-x border-border bg-background overflow-visible">
        {mode !== "fill" && <AddSectionDivider onClick={() => setInsertAtIndex(0)} />}

        {sortedSections.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground/50">
            No sections yet — add one above.
          </div>
        ) : (
          sortedSections.map((section: any, idx: number) => {
            const sectionColor = SECTION_PALETTE[idx % SECTION_PALETTE.length];
            return (
              <div key={section.id}>
                <TemplateSectionCard
                  templateId={templateId || ""}
                  draftId={draftId}
                  section={section}
                  allSections={sortedSections}
                  isFirst={idx === 0}
                  isLast={idx === sortedSections.length - 1}
                  slOffset={sectionSlOffsets[idx]}
                  sectionColor={sectionColor}
                  tokenMap={tokenMap}
                />
                {mode !== "fill" && (
                  <AddSectionDivider
                    onClick={() => setInsertAtIndex(section.sortOrder + 1)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Grand total ── */}
      <GrandTotalRow total={grandTotal} />

      {insertAtIndex !== null && (
        <AddSectionModal
          isOpen={true}
          onClose={() => setInsertAtIndex(null)}
          templateId={templateId || ""}
          draftId={draftId}
          insertAtIndex={insertAtIndex}
          existingSections={sortedSections}
        />
      )}

      {templateId && (
        <AddHeaderFieldModal
          isOpen={isAddHeaderModalOpen}
          onClose={() => setIsAddHeaderModalOpen(false)}
          templateId={templateId}
          onSuccess={() => refetchHeaderFields()}
        />
      )}

      {/* ── Delete Field Alert Dialog ── */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the field from the template. It will not delete the custom field from the global schema, but any formulas relying on this token will become invalid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteField} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Exported workspace ────────────────────────────
export function TemplateBuilderWorkspace({
  templateId,
  draftId,
  zoomLevel = 0,
  project,
}: {
  templateId?: string;
  draftId?: string;
  zoomLevel?: number;
  project?: any;
}) {
  return <WorkspaceInner templateId={templateId} draftId={draftId} zoomLevel={zoomLevel} project={project} />;
}
