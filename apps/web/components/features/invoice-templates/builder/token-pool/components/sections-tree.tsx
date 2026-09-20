import { PoolSectionHeader, SectionLabel, TokenRow } from "../index";
import { SECTION_PALETTE } from "../../template-builder-workspace";

export function SectionsTree({
  sortedSections,
  tokenMap,
  tokenZoomLevel,
  handleTokenClick,
  setShowLegend,
}: {
  sortedSections: any[];
  tokenMap: any;
  tokenZoomLevel: number;
  handleTokenClick: (token: string) => void;
  setShowLegend: (show: boolean) => void;
}) {
  if (sortedSections.length === 0) return null;
  return (
    <div>
      <PoolSectionHeader label="Sections" />
      {sortedSections.map((section: any, idx: number) => {
        const sectionToken: string = section.sectionToken;
        const rows: any[] = (section.rows ?? []).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        const sectionCharges: any[] = section.sectionCharges ?? [];
        const color = SECTION_PALETTE[idx % SECTION_PALETTE.length];

        const sectionLabel = section.label ?? sectionToken.split("_").pop() ?? sectionToken;

        const secBase    = tokenMap[`SEC_${sectionToken}`];
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

              <div className="mt-1 border-t border-border/20 pt-1 space-y-0.5">
                <TokenRow
                  token={`SEC_${sectionToken}`}
                  value={secBase ?? null}
                  type="sec-base"
                  zoomLevel={tokenZoomLevel}
                  onLegendClick={() => setShowLegend(true)}
                  onClick={() => handleTokenClick(`SEC_${sectionToken}`)}
                />
                {sectionCharges.length > 0 && (
                  <TokenRow
                    token={`SEC_${sectionToken}_CHARGES`}
                    value={secCharges ?? null}
                    type="sec-charges"
                    zoomLevel={tokenZoomLevel}
                    onLegendClick={() => setShowLegend(true)}
                    onClick={() => handleTokenClick(`SEC_${sectionToken}_CHARGES`)}
                  />
                )}
                <TokenRow
                  token={`SEC_${sectionToken}_TOTAL`}
                  value={secTotal ?? null}
                  type="sec-total"
                  zoomLevel={tokenZoomLevel}
                  onLegendClick={() => setShowLegend(true)}
                  onClick={() => handleTokenClick(`SEC_${sectionToken}_TOTAL`)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
