"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { TemplateSectionCard } from "./template-section-card";
import { SectionColor } from "./template-row-list";
import { useState } from "react";
import { AddSectionModal } from "./add-section-modal";
import { buildTokenMap, fmt } from "@/lib/formula-evaluator";
import { BuilderProvider, useBuilderContext } from "./builder-context";
import { TemplateFormulaBar } from "./template-formula-bar";
import { cn } from "@/lib/utils";

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
    <div className="flex items-stretch border border-b-0 border-border bg-muted/40 h-9">
      {/* SL */}
      <div className="w-10 shrink-0 flex items-center justify-center border-r border-border text-xs font-bold text-foreground/60">
        SL
      </div>
      {/* Label */}
      <div className="flex-1 px-3 flex items-center gap-2 border-r border-border min-w-0">
        <span className="text-xs font-bold text-foreground/60">Row Label</span>
        <span className="text-xs text-foreground/30">(text displayed in PDF)</span>
      </div>
      {/* USD1 — base/charge values */}
      <div className="w-20 shrink-0 flex items-center justify-center border-r border-border text-xs font-bold text-foreground/60">
        USD
      </div>
      {/* USD2 — row totals */}
      <div className="w-20 shrink-0 flex items-center justify-center text-xs font-bold text-foreground/60">
        USD
      </div>
    </div>
  );
}

// ─── Grand total row ──────────────────────────────────────────────────────────
// Totals in USD2 (right column). No token space (tokens are absolute per-row).
function GrandTotalRow({ total }: { total: number | null }) {
  return (
    <div className="flex items-stretch border border-t-2 border-t-foreground/30 border-border bg-muted/10 h-10">
      {/* SL empty */}
      <div className="w-10 shrink-0 border-r border-border" />
      {/* Label — "Total" right-aligned */}
      <div className="flex-1 px-3 flex items-center justify-end border-r border-border min-w-0">
        <span className="text-sm font-bold text-foreground">Total</span>
      </div>
      {/* USD1 — blank */}
      <div className="w-20 shrink-0 border-r border-border" />
      {/* USD2 — grand total */}
      <div className="w-20 shrink-0 flex items-center justify-end px-3">
        <span className="text-sm font-bold text-foreground tabular-nums">
          {total != null ? fmt(total) : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── File Details Header Box ──────────────────────────────────────────────────
interface FileDetailsHeaderBoxProps {
  projectCustomFields?: Array<{
    id: string;
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    isRequired: boolean;
  }>;
}

function FileDetailsHeaderBox({ projectCustomFields = [], zoomLevel = 0 }: FileDetailsHeaderBoxProps & { zoomLevel?: number }) {
  // Combine system fields with the dynamic custom fields from the database
  const systemFields = [
    { id: "sys-name", fieldName: "Name", fieldKey: "name" },
    { id: "sys-client", fieldName: "Client", fieldKey: "clientId" },
    { id: "sys-status", fieldName: "Status", fieldKey: "status" },
  ];

  const allFields = [...systemFields, ...projectCustomFields];

  // Split into two columns for the layout
  const half = Math.ceil(allFields.length / 2);
  const leftCol = allFields.slice(0, half);
  const rightCol = allFields.slice(half);

  const renderVal = (field: any) => {
    return <span className="text-foreground/20 font-light">—</span>;
  };

  const renderFieldRow = (field: any) => (
    <div key={field.id} className="flex items-center min-w-0">
      <span className="w-32 shrink-0 text-foreground/50 font-bold uppercase tracking-wider truncate" title={field.fieldName}>
        {field.fieldName}
      </span>
      <span className="text-foreground/30 mr-3 shrink-0">:</span>
      <span className="text-foreground font-semibold truncate flex-1 min-w-0">
        {renderVal(field)}
      </span>
    </div>
  );

  if (allFields.length === 0) return null;

  return (
    <div 
      className="border border-border bg-card/10 backdrop-blur-sm font-mono grid grid-cols-2 mt-4 mb-4 rounded-sm select-none"
      style={{ fontSize: 11 + zoomLevel }}
    >
      {/* Left Column */}
      <div className="border-r border-border p-3 space-y-2.5">
        {leftCol.map(renderFieldRow)}
      </div>

      {/* Right Column */}
      <div className="p-3 space-y-2.5">
        {rightCol.map(renderFieldRow)}
      </div>
    </div>
  );
}

// ─── Inner workspace (inside BuilderProvider) ─────────────────────────────────
function WorkspaceInner({ templateId, zoomLevel = 0 }: { templateId: string, zoomLevel?: number }) {
  const { setTokenMap, tokenPoolOpen } = useBuilderContext();
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

  const { data: sections, isLoading } = useQuery({
    queryKey: ["template-sections", templateId],
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
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

  const sortedSections = [...(sections || [])].sort(
    (a: any, b: any) => a.sortOrder - b.sortOrder
  );

  // ── Compute token map and push it to context ──────────────────────────────
  const tokenMap = buildTokenMap(sortedSections);

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
      <FileDetailsHeaderBox projectCustomFields={projectCustomFields} zoomLevel={zoomLevel} />

      {/* ── Sticky formula bar ── */}
      <div className="sticky top-0 z-30 pt-6">
        <TemplateFormulaBar />
      </div>

      {/* ── Table header ── */}
      <TableHeaderRow />

      {/* ── Sections ── */}
      {/* overflow-visible is REQUIRED so row tokens (position:absolute right:100%) escape the border */}
      <div className="border-x border-border bg-background overflow-visible">
        <AddSectionDivider onClick={() => setInsertAtIndex(0)} />

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
                  templateId={templateId}
                  section={section}
                  allSections={sortedSections}
                  isFirst={idx === 0}
                  isLast={idx === sortedSections.length - 1}
                  slOffset={sectionSlOffsets[idx]}
                  sectionColor={sectionColor}
                  tokenMap={tokenMap}
                />
                <AddSectionDivider
                  onClick={() => setInsertAtIndex(section.sortOrder + 1)}
                />
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
          templateId={templateId}
          insertAtIndex={insertAtIndex}
          existingSections={sortedSections}
        />
      )}
    </div>
  );
}

// ─── Exported workspace (wraps in BuilderProvider) ────────────────────────────
export function TemplateBuilderWorkspace({
  templateId,
  tokenPoolOpen = false,
  zoomLevel = 0,
}: {
  templateId: string;
  tokenPoolOpen?: boolean;
  zoomLevel?: number;
}) {
  return (
    <BuilderProvider tokenPoolOpen={tokenPoolOpen}>
      <WorkspaceInner templateId={templateId} zoomLevel={zoomLevel} />
    </BuilderProvider>
  );
}
