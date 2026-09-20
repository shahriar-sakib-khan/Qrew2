import { ConstantTokenCard, PoolSectionHeader } from "../index";
import { GLOBAL_CONSTANTS_INFO } from "./section-info-popover";

export function GlobalConstantsSection({
  orgConfigs,
  tokenZoomLevel,
  handleTokenClick,
  setEditConfig,
  setIsConfigModalOpen,
  setConfigToDelete,
  setShowLegend,
}: {
  orgConfigs: any[];
  tokenZoomLevel: number;
  handleTokenClick: (token: string) => void;
  setEditConfig: (config: any) => void;
  setIsConfigModalOpen: (open: boolean) => void;
  setConfigToDelete: (config: any) => void;
  setShowLegend: (show: boolean) => void;
}) {
  return (
    <div className="px-2">
      <PoolSectionHeader
        label="Global Constants"
        info={GLOBAL_CONSTANTS_INFO}
        action={
          <button
            onClick={() => {
              setEditConfig(null);
              setIsConfigModalOpen(true);
            }}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
            title="Add Global Constant"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">+</span>
          </button>
        }
      />
      {!orgConfigs || orgConfigs.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-muted-foreground/40 italic border border-dashed border-border/40 rounded-lg text-center">
          No global constants
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0.5">
          {orgConfigs.map((config: any) => {
            const tokenName = (config.configKey || "").replace(/^(GBL_|ORG_)/, "");
            return (
              <ConstantTokenCard
                key={config.id}
                token={tokenName}
                value={parseFloat(config.configValue)}
                isPercentage={config.valueType === "percentage"}
                type="global"
                zoomLevel={tokenZoomLevel}
                onClick={() => handleTokenClick(tokenName)}
                onEdit={(e) => {
                  e.stopPropagation();
                  setEditConfig(config);
                  setIsConfigModalOpen(true);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setConfigToDelete(config);
                }}
                onLegendClick={() => setShowLegend(true)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
