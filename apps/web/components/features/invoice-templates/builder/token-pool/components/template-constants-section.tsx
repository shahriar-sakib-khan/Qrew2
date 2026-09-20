import { ConstantTokenCard, PoolSectionHeader } from "../index";
import { TEMPLATE_CONSTANTS_INFO } from "./section-info-popover";

export function TemplateConstantsSection({
  templateConstants,
  tokenZoomLevel,
  handleTokenClick,
  setEditConstant,
  setIsConstantModalOpen,
  setConstantToDelete,
  setShowLegend,
}: {
  templateConstants: any[];
  tokenZoomLevel: number;
  handleTokenClick: (token: string) => void;
  setEditConstant: (constant: any) => void;
  setIsConstantModalOpen: (open: boolean) => void;
  setConstantToDelete: (constant: any) => void;
  setShowLegend: (show: boolean) => void;
}) {
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
        info={TEMPLATE_CONSTANTS_INFO}
        action={
          <button
            onClick={() => {
              setEditConstant(null);
              setIsConstantModalOpen(true);
            }}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
            title="Add Template Constant"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">+</span>
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
              onEdit={(e) => {
                e.stopPropagation();
                setEditConstant(constant);
                setIsConstantModalOpen(true);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                setConstantToDelete(constant);
              }}
              onLegendClick={() => setShowLegend(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
