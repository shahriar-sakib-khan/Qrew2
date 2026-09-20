"use client";

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { buildTokenMap, fmt } from "@/lib/formula-evaluator";
import { SECTION_PALETTE } from "./template-builder-workspace";
import { Plus, Edit2 } from "lucide-react";
import { useState } from "react";
import { AddEditOrgConfigModal } from "@/components/features/org-configs/add-edit-org-config-modal";

type TokenEntry = {
  token: string;
  value: number | null;
  type: "file" | "row-base" | "row-total" | "row-charge" | "sec-base" | "sec-charges" | "sec-charge-item" | "sec-total";
};

function TokenRow({ token, value, type, zoomLevel = 0, onClick }: TokenEntry & { zoomLevel?: number, onClick?: () => void }) {
  const isMissing = value == null;

  const typeStyle: Record<TokenEntry["type"], string> = {
    "file":           "text-sky-400/70",
    "row-base":       "text-foreground/50",
    "row-total":      "text-foreground font-semibold",
    "row-charge":     "text-amber-400/80",
    "sec-base":       "text-muted-foreground",
    "sec-charges":    "text-amber-400/70",
    "sec-charge-item":"text-amber-400/80",
    "sec-total":      "text-foreground font-bold",
  };

  return (
    <div 
      className="flex items-center justify-between gap-2 px-3 py-0.5 rounded hover:bg-muted/20 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <span
        className={`font-mono truncate select-none ${isMissing ? "text-muted-foreground/40" : "text-muted-foreground/80"}`}
        style={{ fontSize: 11 + zoomLevel }}
        title={token}
      >
        {token}
      </span>
      {value != null && (
        <span
          className={`font-mono shrink-0 tabular-nums ${typeStyle[type]}`}
          style={{ fontSize: 12 + zoomLevel }}
        >
          {fmt(value)}
        </span>
      )}
    </div>
  );
}

/** Thin divider label for a section group. */
function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="px-3 pt-3 pb-0.5 text-[11px] font-bold tracking-wider flex items-center gap-2"
      style={{ color }}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

export function TemplateTokenPool({ templateId, zoomLevel = 0 }: { templateId: string; zoomLevel?: number }) {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);

  // ── Global Constants (Org Configs) ────────────────────────────────────────
  const { data: orgConfigs } = useQuery({
    queryKey: ["org-configs"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/org-configs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch configs");
      return res.json();
    },
  });

  // ── Sections query (rows, charges, section charges) ─────────────────────────
  const { data: sections, isLoading: sectionsLoading } = useQuery({
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

  // ── Project Custom Fields (File Tokens) ───────────────────────────────────
  const { data: projectCustomFields } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=project`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  if (sectionsLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  const sortedSections = [...(sections || [])].sort(
    (a: any, b: any) => a.sortOrder - b.sortOrder
  );

  const tokenMap = buildTokenMap(sortedSections, orgConfigs);

  // Compute grand total
  const grandTotal = sortedSections.reduce((sum: number, sec: any) => {
    const v = tokenMap[`SEC_${sec.sectionToken}_TOTAL`];
    return sum + (v ?? 0);
  }, 0);

  // Combine system fields with project custom fields for File Tokens
  const systemFields = [
    { id: "sys-name", fieldName: "Name", fieldKey: "name" },
    { id: "sys-client", fieldName: "Client", fieldKey: "clientId" },
    { id: "sys-status", fieldName: "Status", fieldKey: "status" },
  ];
  const allFileFields = [...systemFields, ...(projectCustomFields || [])];

  if (sortedSections.length === 0 && allFileFields.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground/50">
        No sections or file tokens yet.
      </div>
    );
  }

  const handleTokenClick = (token: string) => {
    window.dispatchEvent(new CustomEvent("insert-token", { detail: token }));
  };

  return (
    <div 
      className="flex flex-col h-full overflow-y-auto"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <h2 className="text-sm font-bold text-foreground">Token Pool</h2>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Use these tokens in formulas.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">

        {/* ── Global Constants ─────────────────────────────────────────────────── */}
        <div className="mb-3">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 italic">
              Global Constants
            </span>
            <button 
              onClick={() => {
                setEditConfig(null);
                setIsConfigModalOpen(true);
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              title="Add Global Constant"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="border-b border-border/20 mb-1" />
          
          {!orgConfigs || orgConfigs.length === 0 ? (
            <div className="px-3 py-1 text-xs text-muted-foreground/50 italic">
              No constants defined
            </div>
          ) : (
            orgConfigs.map((config: any) => (
              <div
                key={config.id}
                className="flex items-center justify-between px-3 py-0.5 rounded hover:bg-muted/20 transition-colors group"
              >
                <div 
                  className="flex items-center gap-2 flex-1 cursor-pointer truncate"
                  onClick={() => handleTokenClick(config.configKey)}
                >
                  <span 
                    className="font-mono text-emerald-400/80 select-none truncate uppercase"
                    style={{ fontSize: 11 + zoomLevel }}
                    title={config.displayLabel}
                  >
                    {config.configKey}
                  </span>
                  <span 
                    className="font-mono text-muted-foreground/60 shrink-0 tabular-nums"
                    style={{ fontSize: 12 + zoomLevel }}
                  >
                    {config.valueType === 'percentage' 
                      ? `${(parseFloat(config.configValue) * 100).toFixed(0)}%` 
                      : fmt(parseFloat(config.configValue))}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditConfig(config);
                    setIsConfigModalOpen(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                  title="Edit Constant"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── File Tokens ──────────────────────────────────────────────────────── */}
        {allFileFields.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 italic">
              File Tokens
            </div>
            <div className="border-b border-border/20 mb-1" />
            {allFileFields.map((field: any) => (
              <div
                key={field.id}
                className="flex items-center px-3 py-0.5 rounded hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => handleTokenClick(field.fieldKey)}
              >
                <span 
                  className="font-mono text-sky-400/70 select-none truncate uppercase"
                  style={{ fontSize: 11 + zoomLevel }}
                >
                  {field.fieldKey}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Section token groups ─────────────────────────────────────────────── */}
        {sortedSections.map((section: any, idx: number) => {
          const sectionToken: string = section.sectionToken;
          const rows: any[] = (section.rows ?? []).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
          const sectionCharges: any[] = section.sectionCharges ?? [];
          const color = SECTION_PALETTE[idx % SECTION_PALETTE.length];

          // Extract the letter suffix from the section token (e.g. "A" from "SECT_A")
          const sectionLabel = section.displayName ?? sectionToken.split("_").pop() ?? sectionToken;

          const secBase    = tokenMap[`SEC_${sectionToken}_BASE`];
          const secCharges = tokenMap[`SEC_${sectionToken}_CHARGES`];
          const secTotal   = tokenMap[`SEC_${sectionToken}_TOTAL`];

          return (
            <div key={section.id} className="mb-3">
              <SectionLabel label={sectionLabel} color={color.border} />
              <div className="border-b border-border/20 mx-3 mb-1" />

              {/* Row tokens */}
              {rows.map((row: any) => {
                const rowCharges: any[] = row.charges ?? [];
                const rowBaseVal  = tokenMap[row.rowToken];
                const rowTotalVal = tokenMap[`${row.rowToken}_TOTAL`];

                return (
                  <div key={row.id}>
                    {/* Row base token — always shown */}
                    <TokenRow
                      token={row.rowToken}
                      value={rowBaseVal ?? null}
                      type="row-base"
                      zoomLevel={zoomLevel}
                      onClick={() => handleTokenClick(row.rowToken)}
                    />

                    {/* Row total token — always shown */}
                    <TokenRow
                      token={`${row.rowToken}_TOTAL`}
                      value={rowTotalVal ?? null}
                      type="row-total"
                      zoomLevel={zoomLevel}
                      onClick={() => handleTokenClick(`${row.rowToken}_TOTAL`)}
                    />

                    {/* Row charge tokens */}
                    {rowCharges.map((charge: any) =>
                      charge.chargeToken ? (
                        <TokenRow
                          key={charge.id}
                          token={charge.chargeToken}
                          value={tokenMap[charge.chargeToken] ?? null}
                          type="row-charge"
                          zoomLevel={zoomLevel}
                          onClick={() => handleTokenClick(charge.chargeToken)}
                        />
                      ) : null
                    )}
                  </div>
                );
              })}

              {/* Section aggregate tokens */}
              <div className="mt-1 border-t border-border/20 pt-1 mx-1">
                <TokenRow token={`SEC_${sectionToken}_BASE`}    value={secBase    ?? null} type="sec-base" zoomLevel={zoomLevel} onClick={() => handleTokenClick(`SEC_${sectionToken}_BASE`)} />
                <TokenRow token={`SEC_${sectionToken}_CHARGES`} value={secCharges ?? null} type="sec-charges" zoomLevel={zoomLevel} onClick={() => handleTokenClick(`SEC_${sectionToken}_CHARGES`)} />

                {sectionCharges.map((sc: any) =>
                  sc.chargeToken ? (
                    <TokenRow
                      key={sc.id}
                      token={sc.chargeToken}
                      value={tokenMap[sc.chargeToken] ?? null}
                      type="sec-charge-item"
                      zoomLevel={zoomLevel}
                      onClick={() => handleTokenClick(sc.chargeToken)}
                    />
                  ) : null
                )}

                <TokenRow token={`SEC_${sectionToken}_TOTAL`} value={secTotal ?? null} type="sec-total" zoomLevel={zoomLevel} onClick={() => handleTokenClick(`SEC_${sectionToken}_TOTAL`)} />
              </div>
            </div>
          );
        })}

        {/* Grand total */}
        <div className="mt-2 border-t-2 border-border pt-2 mx-3">
          <div className="flex items-center justify-between gap-2 px-0 py-1">
            <span className="text-xs font-bold text-foreground">Grand Total</span>
            <span className="font-mono text-sm font-bold text-foreground tabular-nums">
              {fmt(grandTotal)}
            </span>
          </div>
        </div>

      </div>

      <AddEditOrgConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        editConfig={editConfig}
      />
    </div>
  );
}
