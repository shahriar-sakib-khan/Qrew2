"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { buildTokenMap, fmt } from "@/lib/formula-evaluator";
import { SECTION_PALETTE } from "./template-builder-workspace";
import { Plus, Edit2, Trash2, Info, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

// Color config per token type — applied to the token name chip
const TOKEN_TYPE_CONFIG: Record<TokenEntry["type"], { chip: string; dot: string; value: string; label: string; description: string }> = {
  "file":            { chip: "bg-sky-500/10 text-sky-400 border border-sky-500/20",          dot: "bg-sky-400",            value: "text-sky-400",                  label: "File Field",        description: "A value from this invoice's file/project details (e.g. a custom number field)" },
  "row-base":        { chip: "bg-muted/30 text-muted-foreground border border-border/30",     dot: "bg-muted-foreground/60", value: "text-muted-foreground",          label: "Row Base",          description: "The raw base value entered directly into a row cell" },
  "row-total":       { chip: "bg-violet-500/10 text-violet-300 border border-violet-500/20", dot: "bg-violet-400",          value: "text-violet-300 font-semibold",  label: "Row Total",         description: "Row base + all row-level charges combined" },
  "row-charge":      { chip: "bg-amber-500/10 text-amber-400 border border-amber-500/20",    dot: "bg-amber-400",          value: "text-amber-400",                label: "Row Charge",        description: "A computed charge applied to a specific row (e.g. surcharge, tax)" },
  "sec-base":        { chip: "bg-muted/20 text-muted-foreground/70 border border-border/20", dot: "bg-muted-foreground/40", value: "text-muted-foreground/70",        label: "Section Base",      description: "Sum of all row base values in this section" },
  "sec-charges":     { chip: "bg-amber-500/8 text-amber-400/80 border border-amber-500/15", dot: "bg-amber-400/70",        value: "text-amber-400/80",              label: "Section Charges",   description: "Sum of all section-level charges (not row charges)" },
  "sec-charge-item": { chip: "bg-amber-500/10 text-amber-400 border border-amber-500/20",    dot: "bg-amber-400",          value: "text-amber-400",                label: "Section Charge Item",description: "A single named charge applied at the section level" },
  "sec-total":       { chip: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", dot: "bg-emerald-400",      value: "text-emerald-400 font-bold",     label: "Section Total",     description: "Section base + all section-level charges — the final section value" },
};

const CONSTANT_LEGEND = [
  { dot: "bg-emerald-400", label: "Global Constant",   description: "Org-wide constant shared across all templates and invoices" },
  { dot: "bg-blue-400",    label: "Template Constant", description: "A fixed value defined specifically for this template" },
  { dot: "bg-sky-400",     label: "File Field",         description: "A numeric value pulled from the invoice file/project" },
];

function TokenRow({ token, value, type, zoomLevel = 0, onClick, onLegendClick }: TokenEntry & { zoomLevel?: number, onClick?: () => void, onLegendClick?: () => void }) {
  const isMissing = value == null;
  const cfg = TOKEN_TYPE_CONFIG[type];

  return (
    <div
      className="flex items-center justify-between gap-2 px-2 py-0.5 rounded hover:bg-muted/20 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <span
        className={`inline-flex items-center gap-1.5 font-mono truncate select-none rounded px-1.5 py-0.5 leading-none ${cfg.chip}`}
        style={{ fontSize: 13 + zoomLevel }}
      >
        <button type="button" onClick={(e) => { e.stopPropagation(); onLegendClick?.(); }} className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} title={cfg.label} />
        {token}
      </span>
      {value != null && (
        <span
          className={`font-mono shrink-0 tabular-nums ${cfg.value}`}
          style={{ fontSize: 14 + zoomLevel }}
        >
          {fmt(value)}
        </span>
      )}
      {isMissing && (
        <span className="font-mono text-[11px] text-muted-foreground/30 shrink-0">—</span>
      )}
    </div>
  );
}

function FileTokenRow({ token, label, isNumeric, zoomLevel = 0, onClick, onLegendClick }: { token: string; label: string; isNumeric: boolean; zoomLevel?: number; onClick?: () => void, onLegendClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2 py-0.5 rounded transition-colors group ${isNumeric ? "hover:bg-muted/20 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
      onClick={onClick}
      title={isNumeric ? `Insert ${token}` : `${label} is a text field and cannot be used in formulas`}
    >
      <span
        className="inline-flex items-center gap-1.5 font-mono truncate select-none rounded px-1.5 py-0.5 leading-none bg-sky-500/10 text-sky-400 border border-sky-500/20"
        style={{ fontSize: 13 + zoomLevel }}
      >
        <button type="button" onClick={(e) => { e.stopPropagation(); onLegendClick?.(); }} className="w-1.5 h-1.5 rounded-full shrink-0 bg-sky-400" title="File Field" />
        {token}
      </span>
      <span className="text-[12px] text-muted-foreground/40 shrink-0 truncate max-w-[60px] italic text-right" style={{ fontSize: 11 + zoomLevel }}>{label}</span>
    </div>
  );
}

function ConstantTokenCard({ 
  token, value, type, isPercentage, zoomLevel = 0, onClick, onEdit, onDelete, onLegendClick 
}: { 
  token: string, value?: number | null, type: 'global' | 'template' | 'file', isPercentage?: boolean, zoomLevel?: number, onClick: () => void, onEdit?: (e: React.MouseEvent) => void, onDelete?: (e: React.MouseEvent) => void, onLegendClick?: () => void 
}) {
  const styles = {
    global: "text-emerald-400 hover:bg-emerald-500/10",
    template: "text-blue-400 hover:bg-blue-500/10",
    file: "text-sky-400 hover:bg-sky-500/10"
  };
  const dots = {
    global: "bg-emerald-400",
    template: "bg-blue-400",
    file: "bg-sky-400",
  };
  const labels = {
    global: "Global Constant",
    template: "Template Constant",
    file: "File Field"
  };

  const formattedValue = value != null 
    ? (isPercentage ? `${(value * 100).toFixed(0)}%` : fmt(value))
    : null;

  return (
    <div 
      className={`group flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${styles[type]}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1.5 font-mono truncate select-none" style={{ fontSize: 13 + zoomLevel }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onLegendClick?.(); }} className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[type]}`} title={labels[type]} />
        {token}
      </span>
      
      <div className="flex items-center gap-2">
        {formattedValue !== null && (
          <span className="font-mono tabular-nums shrink-0 opacity-80" style={{ fontSize: 14 + zoomLevel }}>
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
function SectionLabel({ 
  label, color, sectionToken, secBase, secCharges, secTotal, tokenZoomLevel, handleTokenClick 
}: { 
  label: string; color: string; sectionToken: string; secBase?: number | null; secCharges?: number | null; secTotal?: number | null; tokenZoomLevel: number; handleTokenClick: (t: string) => void;
}) {
  return (
    <div className="px-3 pt-3 pb-1 flex items-center justify-between gap-2">
      <div
        className="font-bold tracking-wider flex items-center gap-1.5 shrink-0"
        style={{ color, fontSize: 12 + tokenZoomLevel }}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {label}
      </div>
      
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => handleTokenClick(`SEC_${sectionToken}_BASE`)}
          className="border border-muted-foreground/20 text-muted-foreground/70 hover:bg-muted/20 hover:text-muted-foreground px-1.5 py-0.5 rounded font-mono tracking-tighter whitespace-nowrap transition-colors"
          style={{ fontSize: 10 + tokenZoomLevel }}
          title={`SEC_${sectionToken}_BASE: ${secBase != null ? fmt(secBase) : '—'}`}
        >
          BASE
        </button>
        <button
          onClick={() => handleTokenClick(`SEC_${sectionToken}_CHARGES`)}
          className="border border-amber-500/20 text-amber-500/80 hover:bg-amber-500/10 hover:text-amber-500 px-1.5 py-0.5 rounded font-mono tracking-tighter whitespace-nowrap transition-colors"
          style={{ fontSize: 10 + tokenZoomLevel }}
          title={`SEC_${sectionToken}_CHARGES: ${secCharges != null ? fmt(secCharges) : '—'}`}
        >
          CHG
        </button>
        <button
          onClick={() => handleTokenClick(`SEC_${sectionToken}_TOTAL`)}
          className="border border-emerald-500/20 text-emerald-500/80 hover:bg-emerald-500/10 hover:text-emerald-500 px-1.5 py-0.5 rounded font-mono tracking-tighter whitespace-nowrap font-bold transition-colors"
          style={{ fontSize: 10 + tokenZoomLevel }}
          title={`SEC_${sectionToken}_TOTAL: ${secTotal != null ? fmt(secTotal) : '—'}`}
        >
          TOTAL
        </button>
      </div>
    </div>
  );
}

function PoolSectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 mb-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </span>
      {action}
    </div>
  );
}

export function TemplateTokenPool({ templateId, draftId }: { templateId?: string; draftId?: string; }) {
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
  const [showLegend, setShowLegend] = useState(false);
  const [tokenZoomLevel, setTokenZoomLevel] = useState(0);
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

  // ALL header fields sorted — show all, dimmed if not injectable (text fields)
  const allFileFields = [...(templateHeaderFields || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Token Pool</h2>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Click a token to insert it into a formula.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-border rounded-md px-0.5 h-7 bg-background shadow-sm">
                <button
                  onClick={() => setTokenZoomLevel(z => Math.max(z - 1, -4))}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Decrease Font Size"
                >
                  <span className="text-lg leading-none font-medium mb-1">-</span>
                </button>
                <span className="text-[10px] font-mono w-4 text-center select-none text-muted-foreground">
                  {tokenZoomLevel > 0 ? `+${tokenZoomLevel}` : tokenZoomLevel}
                </span>
                <button
                  onClick={() => setTokenZoomLevel(z => Math.min(z + 1, 8))}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Increase Font Size"
                >
                  <span className="text-lg leading-none font-medium mb-1">+</span>
                </button>
              </div>
              <button
                onClick={() => setShowLegend(true)}
                className={`p-1.5 rounded transition-colors ${
                  showLegend ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/30"
                }`}
                title="Token color legend"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Color Legend Modal */}
        <Dialog open={showLegend} onOpenChange={setShowLegend}>
          <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b border-border/40 bg-muted/20">
              <DialogTitle className="text-sm">Token Color Legend</DialogTitle>
              <DialogDescription className="text-[11px]">
                Understand the different types of tokens available in formulas.
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 space-y-1 max-h-[60vh] overflow-y-auto">
              {/* Token type rows */}
              {(Object.entries(TOKEN_TYPE_CONFIG) as [TokenEntry["type"], typeof TOKEN_TYPE_CONFIG[TokenEntry["type"]]][]).map(([, cfg]) => (
                <div key={cfg.label} className="flex items-start gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <span className={`text-xs font-semibold leading-none ${cfg.chip.match(/text-[^\s]+/)?.[0] ?? "text-foreground"}`}>{cfg.label}</span>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{cfg.description}</p>
                  </div>
                </div>
              ))}
              {/* Divider */}
              <div className="border-t border-border/30 my-2 mx-2" />
              {/* Constant types */}
              {CONSTANT_LEGEND.map(item => (
                <div key={item.label} className="flex items-start gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${item.dot}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold leading-none text-foreground/70">{item.label}</span>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 overflow-y-auto py-3 space-y-5">

          {/* ── Global Constants ─────────────────────────────────────────────────── */}
          <div className="px-2">
            <PoolSectionHeader
              label="Global Constants"
              action={
                <button
                  onClick={() => { setEditConfig(null); setIsConfigModalOpen(true); }}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  title="Add Global Constant"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              }
            />
            {!orgConfigs || orgConfigs.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-muted-foreground/40 italic border border-dashed border-border/40 rounded-lg text-center">
                No global constants
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-0.5">
                {orgConfigs.map((config: any) => (
                  <ConstantTokenCard
                    key={config.id}
                    token={config.configKey}
                    value={parseFloat(config.configValue)}
                    isPercentage={config.valueType === 'percentage'}
                    type="global"
                    zoomLevel={tokenZoomLevel}
                    onClick={() => handleTokenClick(config.configKey)}
                    onEdit={(e) => { e.stopPropagation(); setEditConfig(config); setIsConfigModalOpen(true); }}
                    onDelete={(e) => { e.stopPropagation(); deleteConfigMutation.mutate(config.id); }}
                    onLegendClick={() => setShowLegend(true)}
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
              <div className="px-2">
                <PoolSectionHeader
                  label="Template Constants"
                  action={
                    <button
                      onClick={() => { setEditConstant(null); setIsConstantModalOpen(true); }}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      title="Add Template Constant"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                {!normalizedTemplateConstants || normalizedTemplateConstants.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground/40 italic border border-dashed border-border/40 rounded-lg text-center">
                    No template constants
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-0.5">
                    {normalizedTemplateConstants.map((constant: any) => (
                      <ConstantTokenCard
                        key={constant.id}
                        token={constant.token}
                        value={parseFloat(constant.defaultValue)}
                        type="template"
                        zoomLevel={tokenZoomLevel}
                        onClick={() => handleTokenClick(constant.token)}
                        onEdit={(e) => { e.stopPropagation(); setEditConstant(constant); setIsConstantModalOpen(true); }}
                        onDelete={(e) => { e.stopPropagation(); deleteConstantMutation.mutate(constant.id); }}
                        onLegendClick={() => setShowLegend(true)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── File / Header Tokens ──────────────────────────────────────────────── */}
          {allFileFields.length > 0 && (
            <div className="px-2">
              <PoolSectionHeader label="File Details" />
              <div className="grid grid-cols-1 gap-0.5">
                {allFileFields.map((field: any) => {
                  const token = getFileToken(field);
                  const isNumeric = field.isFormulaInjectable === true;
                  return (
                    <FileTokenRow
                      key={field.id}
                      token={token}
                      label={field.label}
                      isNumeric={isNumeric}
                      zoomLevel={tokenZoomLevel}
                      onLegendClick={() => setShowLegend(true)}
                      onClick={isNumeric ? () => handleTokenClick(token) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section token groups ─────────────────────────────────────────────── */}
          {sortedSections.length > 0 && (
            <div>
              <PoolSectionHeader label="Sections" />
              {sortedSections.map((section: any, idx: number) => {
                const sectionToken: string = section.sectionToken;
                const rows: any[] = (section.rows ?? []).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
                const sectionCharges: any[] = section.sectionCharges ?? [];
                const color = SECTION_PALETTE[idx % SECTION_PALETTE.length];

                const sectionLabel = section.displayName ?? sectionToken.split("_").pop() ?? sectionToken;

                const secBase    = tokenMap[`SEC_${sectionToken}_BASE`];
                const secCharges = tokenMap[`SEC_${sectionToken}_CHARGES`];
                const secTotal   = tokenMap[`SEC_${sectionToken}_TOTAL`];

                return (
                  <div key={section.id} className="mb-2">
                    <SectionLabel 
                      label={sectionLabel} 
                      color={color.border} 
                      sectionToken={sectionToken} 
                      secBase={secBase} 
                      secCharges={secCharges} 
                      secTotal={secTotal} 
                      tokenZoomLevel={tokenZoomLevel} 
                      handleTokenClick={handleTokenClick} 
                    />
                    <div className="border-b border-border/20 mx-3 mb-1" />

                    <div className="px-1 space-y-0.5">
                      {/* Row tokens */}
                      {rows.map((row: any) => {
                        const rowCharges: any[] = row.charges ?? [];
                        const rowBaseVal  = tokenMap[row.rowToken];
                        const rowTotalVal = tokenMap[`${row.rowToken}_TOTAL`];

                        return (
                          <div key={row.id} className="space-y-0.5">
                            <TokenRow
                              token={row.rowToken}
                              value={rowBaseVal ?? null}
                              type="row-base"
                              zoomLevel={tokenZoomLevel}
                      onLegendClick={() => setShowLegend(true)}
                              onClick={() => handleTokenClick(row.rowToken)}
                            />

                            {rowCharges.length > 0 && (
                              <TokenRow
                                token={`${row.rowToken}_TOTAL`}
                                value={rowTotalVal ?? null}
                                type="row-total"
                                zoomLevel={tokenZoomLevel}
                      onLegendClick={() => setShowLegend(true)}
                                onClick={() => handleTokenClick(`${row.rowToken}_TOTAL`)}
                              />
                            )}

                            {rowCharges.map((charge: any) =>
                              charge.chargeToken ? (
                                <TokenRow
                                  key={charge.id}
                                  token={charge.chargeToken}
                                  value={tokenMap[charge.chargeToken] ?? null}
                                  type="row-charge"
                                  zoomLevel={tokenZoomLevel}
                      onLegendClick={() => setShowLegend(true)}
                                  onClick={() => handleTokenClick(charge.chargeToken)}
                                />
                              ) : null
                            )}
                          </div>
                        );
                      })}

                      {/* Section aggregate tokens */}
                      {sectionCharges.length > 0 && (
                        <div className="mt-1 border-t border-border/20 pt-1 space-y-0.5">
                          {sectionCharges.map((sc: any) =>
                            sc.chargeToken ? (
                              <TokenRow
                                key={sc.id}
                                token={sc.chargeToken}
                                value={tokenMap[sc.chargeToken] ?? null}
                                type="sec-charge-item"
                                zoomLevel={tokenZoomLevel}
                                onLegendClick={() => setShowLegend(true)}
                                onClick={() => handleTokenClick(sc.chargeToken)}
                              />
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grand total */}
          <div className="border-t-2 border-border mx-3 pt-2 pb-2">
            <div className="flex items-center justify-between gap-2 px-2 py-1">
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
