"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { buildTokenMap, fmt } from "@/lib/formula-evaluator";
import { SECTION_PALETTE } from "./template-builder-workspace";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddEditOrgConfigModal } from "@/components/features/org-configs/add-edit-org-config-modal";
import { AddEditTemplateConstantModal } from "./add-edit-template-constant-modal";
import { useBuilderContext } from "./builder-context";

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
        style={{ fontSize: 13 + zoomLevel }}
        title={token}
      >
        {token}
      </span>
      {value != null && (
        <span
          className={`font-mono shrink-0 tabular-nums ${typeStyle[type]}`}
          style={{ fontSize: 14 + zoomLevel }}
        >
          {fmt(value)}
        </span>
      )}
    </div>
  );
}

function ConstantTokenCard({ 
  token, value, type, isPercentage, onClick, onEdit, onDelete 
}: { 
  token: string, value?: number | null, type: 'global' | 'template' | 'file', isPercentage?: boolean, onClick: () => void, onEdit?: (e: React.MouseEvent) => void, onDelete?: (e: React.MouseEvent) => void 
}) {
  const styles = {
    global: "text-emerald-400 hover:bg-emerald-500/10",
    template: "text-blue-400 hover:bg-blue-500/10",
    file: "text-sky-400 hover:bg-sky-500/10"
  };

  const formattedValue = value != null 
    ? (isPercentage ? `${(value * 100).toFixed(0)}%` : fmt(value))
    : null;

  return (
    <div 
      className={`group flex items-center justify-between gap-2 px-3 py-1 rounded cursor-pointer transition-colors ${styles[type]}`}
      onClick={onClick}
    >
      <span className="font-mono text-[13px] truncate select-none" title={token}>{token}</span>
      
      <div className="flex items-center gap-2">
        {formattedValue !== null && (
          <span className="font-mono text-[14px] tabular-nums shrink-0 opacity-80">
            {formattedValue}
          </span>
        )}
        
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-muted-foreground hover:text-destructive rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
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

export function TemplateTokenPool({ templateId, draftId, zoomLevel = 0 }: { templateId?: string; draftId?: string; zoomLevel?: number }) {
  const isDraftMode = !!draftId;
  const apiBasePath = isDraftMode
    ? `${apiUrl}/api/invoices/drafts/${draftId}`
    : `${apiUrl}/api/invoice-templates/${templateId}`;

  const invalidateConstantsKey = isDraftMode
    ? ["draft-constants", draftId]
    : ["template-constants", templateId];

  const invalidateSectionsKey = isDraftMode
    ? ["draft-sections", draftId]
    : ["template-sections", templateId];
  const { mode } = useBuilderContext();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);

  const [isConstantModalOpen, setIsConstantModalOpen] = useState(false);
  const [editConstant, setEditConstant] = useState<any>(null);

  const queryClient = useQueryClient();

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Delete this global constant?")) throw new Error("cancelled");
      const res = await fetch(`${apiUrl}/api/org-configs/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete config");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Global constant deleted");
      queryClient.invalidateQueries({ queryKey: ["org-configs"] });
    },
    onError: (err: any) => {
      if (err.message !== "cancelled") toast.error(err.message);
    }
  });

  const deleteConstantMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Delete this template constant?")) throw new Error("cancelled");
      const res = await fetch(`${apiBasePath}/constants/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete constant");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template constant deleted");
      queryClient.invalidateQueries({ queryKey: invalidateConstantsKey });
    },
    onError: (err: any) => {
      if (err.message !== "cancelled") toast.error(err.message);
    }
  });

  // ── Global Constants (Org Configs) ────────────────────────────────────────
  const { data: orgConfigs } = useQuery({
    queryKey: ["org-configs"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/org-configs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch configs");
      return res.json();
    },
  });

  // ── Template / Draft Constants ────────────────────────────────────────────────────
  const { data: templateConstants } = useQuery({
    queryKey: invalidateConstantsKey,
    queryFn: async () => {
      const res = await fetch(`${apiBasePath}/constants`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch constants");
      return res.json();
    },
  });

  // ── Sections query (rows, charges, section charges) ─────────────────────────
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: invalidateSectionsKey,
    queryFn: async () => {
      const res = await fetch(`${apiBasePath}/sections`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
  });

  // ── Template Header Fields (File Tokens) ───────────────────────────────────
  const { data: templateHeaderFields } = useQuery({
    queryKey: ["template-header-fields", templateId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-templates/${templateId}/header-fields`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch header fields");
      return res.json();
    },
    enabled: !!templateId,
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

  const tokenMap = buildTokenMap(sortedSections, orgConfigs, templateConstants);

  // Compute grand total
  const grandTotal = sortedSections.reduce((sum: number, sec: any) => {
    const v = tokenMap[`SEC_${sec.sectionToken}_TOTAL`];
    return sum + (v ?? 0);
  }, 0);

  const allFileFields = templateHeaderFields || [];
  const injectableFileFields = allFileFields.filter((f: any) => f.isFormulaInjectable);

  const getFileToken = (field: any) => {
    if (field.fieldType === "file_field" && field.fileFieldKey) return `FILE_${field.fileFieldKey.toUpperCase()}`;
    if (field.fieldType === "org_config" && field.orgConfigKey) return `ORG_${field.orgConfigKey.toUpperCase()}`;
    return `FILE_${(field.label || "").toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  };



  const handleTokenClick = (token: string) => {
    window.dispatchEvent(new CustomEvent("insert-token", { detail: token }));
  };

  return (
    <>
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
          <div className="mb-4 mx-3">
            <div className="flex items-center justify-between mb-2">
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
            {!orgConfigs || orgConfigs.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground/50 italic border border-dashed rounded-lg text-center">
                No global constants
              </div>
            ) : (
              <div className="grid grid-cols-1">
                {orgConfigs.map((config: any) => (
                  <ConstantTokenCard
                    key={config.id}
                    token={config.configKey}
                    value={parseFloat(config.configValue)}
                    isPercentage={config.valueType === 'percentage'}
                    type="global"
                    onClick={() => handleTokenClick(config.configKey)}
                    onEdit={(e) => {
                      e.stopPropagation();
                      setEditConfig(config);
                      setIsConfigModalOpen(true);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      deleteConfigMutation.mutate(config.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Template Constants ───────────────────────────────────────────────── */}
          {(() => {
            const normalizedTemplateConstants = Array.isArray(templateConstants)
              ? templateConstants
              : Object.values(templateConstants || {}).map((c: any) => ({
                  id: c.id,
                  token: c.key,
                  defaultValue: c.value,
                  ...c,
                }));

            return (
              <div className="mb-4 mx-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 italic">
                Template Constants
              </span>
              <button
                onClick={() => {
                  setEditConstant(null);
                  setIsConstantModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                title="Add Template Constant"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {!normalizedTemplateConstants || normalizedTemplateConstants.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground/50 italic border border-dashed rounded-lg text-center">
                No template constants
              </div>
            ) : (
              <div className="grid grid-cols-1">
                {normalizedTemplateConstants.map((constant: any) => (
                  <ConstantTokenCard
                    key={constant.id}
                    token={constant.token}
                    value={parseFloat(constant.defaultValue)}
                    type="template"
                    onClick={() => handleTokenClick(constant.token)}
                    onEdit={(e) => {
                      e.stopPropagation();
                      setEditConstant(constant);
                      setIsConstantModalOpen(true);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      deleteConstantMutation.mutate(constant.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          );
          })()}

          {/* ── File Tokens & Section Tokens ──────────────────────────────────────────────────────── */}
          {injectableFileFields.length > 0 && (
            <div className="mb-5 mx-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 italic mb-2">
                File Tokens
              </div>
              <div className="grid grid-cols-1">
                {injectableFileFields.map((field: any) => (
                  <ConstantTokenCard
                    key={field.id}
                    token={getFileToken(field)}
                    type="file"
                    onClick={() => handleTokenClick(getFileToken(field))}
                  />
                ))}
              </div>
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

                      {/* Row total token — only shown if there are row charges */}
                      {rowCharges.length > 0 && (
                        <TokenRow
                          token={`${row.rowToken}_TOTAL`}
                          value={rowTotalVal ?? null}
                          type="row-total"
                          zoomLevel={zoomLevel}
                          onClick={() => handleTokenClick(`${row.rowToken}_TOTAL`)}
                        />
                      )}

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
      </div>

      <AddEditOrgConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        editConfig={editConfig}
      />
      <AddEditTemplateConstantModal
        apiBasePath={apiBasePath}
        invalidateKey={invalidateConstantsKey}
        isOpen={isConstantModalOpen}
        onClose={() => setIsConstantModalOpen(false)}
        editConstant={editConstant}
      />
    </>
  );
}
