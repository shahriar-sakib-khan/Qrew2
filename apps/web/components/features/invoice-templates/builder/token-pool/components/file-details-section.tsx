import { FileTokenRow, PoolSectionHeader } from "../index";
import { FILE_DETAILS_INFO } from "./section-info-popover";

export function FileDetailsSection({
  allFileFields,
  getFileToken,
  tokenZoomLevel,
  handleTokenClick,
  setShowLegend,
}: {
  allFileFields: any[];
  getFileToken: (field: any) => string;
  tokenZoomLevel: number;
  handleTokenClick: (token: string) => void;
  setShowLegend: (show: boolean) => void;
}) {
  if (allFileFields.length === 0) return null;
  return (
    <div className="px-2">
      <PoolSectionHeader label="File Details" info={FILE_DETAILS_INFO} />
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
  );
}
