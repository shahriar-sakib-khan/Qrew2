import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";
import { useBuilderContext } from "../../builder-context";

export function ClickableCell({
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

export function TableRow({
  token,
  sl,
  labelContent,
  usd1,
  usd2,
  formula,
  className,
  actions,
  mobileActions,
  style,
  onClickUsd1,
  onClickUsd2,
  onClickFormula,
  isUsd1Selected,
  isUsd2Selected,
  notices,
  zoomLevel = 0,
  onEditToken,
}: {
  token?: string;
  sl?: React.ReactNode;
  labelContent: React.ReactNode;
  usd1?: React.ReactNode;
  usd2?: React.ReactNode;
  formula?: string;
  className?: string;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  style?: React.CSSProperties;
  onClickUsd1?: () => void;
  onClickUsd2?: () => void;
  onClickFormula?: () => void;
  isUsd1Selected?: boolean;
  isUsd2Selected?: boolean;
  notices?: any[];
  zoomLevel?: number;
  onEditToken?: () => void;
}) {
  const { selectedCell } = useBuilderContext();
  const isFormulaMode = !!selectedCell;

  const handleTokenClick = (e: React.MouseEvent, clickedToken: string) => {
    e.stopPropagation();
    if (isFormulaMode) {
      window.dispatchEvent(new CustomEvent("insert-token", { detail: clickedToken }));
    } else {
      navigator.clipboard.writeText(clickedToken);
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-stretch border-b border-border group/row hover:z-[60]",
        "hover:bg-muted/5 transition-colors bg-background",
        notices && notices.length > 0 && "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]",
        className
      )}
      style={style}
    >
      {token && (
        <div 
          className={cn(
            "absolute right-full top-0 bottom-0 w-36 min-w-[9rem] hover:w-auto flex items-center justify-end pr-3 select-none transition-colors insertable-token",
            "z-10 hover:z-50 hover:pl-4 rounded-l-md group/token",
            isFormulaMode 
              ? "cursor-pointer text-primary hover:bg-primary/5 hover:border-primary/20" 
              : "cursor-pointer hover:text-foreground hover:bg-muted hover:shadow-sm"
          )}
          onClick={(e) => handleTokenClick(e, token)}
          title={isFormulaMode ? "Insert into formula" : "Copy token"}
        >
          <div className="flex items-center gap-2">
            {onEditToken && !isFormulaMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/token:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditToken();
                }}
                title="Edit Token"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            <span className={cn(
              "font-mono font-semibold truncate leading-none",
              isFormulaMode ? "text-primary/70" : "text-muted-foreground/70"
            )} style={{ fontSize: 12 + zoomLevel }}>
              {token}
            </span>
          </div>
        </div>
      )}

      <div className="absolute left-full top-0 bottom-0 flex items-center pl-3 gap-2 z-20">
        {formula && (() => {
          const isLikelyTruncated = formula.length > 22;
          return (
            <div
              className={cn(
                "relative select-none shrink-0",
                isLikelyTruncated && "group/formula",
                onClickFormula
                  ? "cursor-pointer hover:opacity-100 opacity-80 transition-opacity"
                  : "pointer-events-none"
              )}
              onClick={onClickFormula}
            >
              <div
                className={cn(
                  "font-mono font-semibold leading-none px-2.5 py-1.5 rounded-md transition-colors inline-flex relative z-30 max-w-[12rem] border border-primary/10 shadow-sm overflow-hidden group/badge",
                  onClickFormula
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "bg-muted/60 text-muted-foreground"
                )}
                style={{ fontSize: 12 + zoomLevel }}
              >
                <span className="truncate">{formula}</span>
                {onClickFormula && (
                  <div className="absolute inset-y-0 right-0 flex items-center bg-background/80 backdrop-blur-sm pl-3 pr-2 opacity-0 group-hover/badge:opacity-100 transition-opacity">
                    <span className="text-[10px] font-sans text-primary/80 italic bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shadow-sm">
                      Click to edit
                    </span>
                  </div>
                )}
              </div>
              {isLikelyTruncated && (
                <div className="absolute top-full left-0 mt-1.5 hidden group-hover/formula:block z-[100] w-72 p-3 rounded-md border border-border bg-background shadow-2xl cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-sans font-bold text-muted-foreground/70 uppercase tracking-wider">
                      Full Formula
                    </span>
                  </div>
                  <div className="font-mono text-xs whitespace-pre-wrap break-all leading-relaxed text-foreground/90 bg-muted p-2 rounded border border-border/50" style={{ fontSize: 12 + zoomLevel }}>
                    {formula}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {actions && (
          <div className="hidden md:flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
            <div className="relative flex items-center gap-0.5 bg-background rounded-md shadow-sm border border-border/50 px-0.5 py-0.5">
              {actions}
            </div>
          </div>
        )}
      </div>

      <div 
        className={cn(
          "w-10 shrink-0 flex items-center justify-center border-r border-border font-bold transition-colors select-none",
          token ? (
            isFormulaMode 
              ? "cursor-pointer text-primary hover:bg-primary/10" 
              : "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/10"
          ) : "text-muted-foreground"
        )}
        onClick={(e) => token && handleTokenClick(e, token)}
        title={token ? (isFormulaMode ? "Insert into formula" : "Copy token") : undefined}
        style={{ fontSize: 14 + zoomLevel }}
      >
        {sl}
      </div>

      <div className="flex-1 px-3 py-1.5 flex items-center justify-between gap-2 border-r border-border min-w-0 overflow-hidden font-medium" style={{ fontSize: 14 + zoomLevel }}>
        <div className="flex items-center gap-2 min-w-0 truncate">
          {labelContent}
        </div>
        {mobileActions && (
          <div className="md:hidden shrink-0 flex items-center ml-1">
            {mobileActions}
          </div>
        )}
      </div>

      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end border-r border-border",
          "font-bold text-foreground tabular-nums",
          onClickUsd1 ? "p-1" : "px-2 py-1"
        )}
        style={{ fontSize: 16 + zoomLevel }}
      >
        <ClickableCell onClick={onClickUsd1} isSelected={isUsd1Selected} className="px-2">
          {usd1 ?? (
            onClickUsd1 ? (
              <span className="text-muted-foreground/30 text-sm select-none">—</span>
            ) : (
              <span className="text-muted-foreground/30 text-[10px] uppercase tracking-wider select-none">Not editable</span>
            )
          )}
        </ClickableCell>
      </div>

      <div
        className={cn(
          "w-20 shrink-0 flex items-center justify-end",
          "font-bold text-foreground tabular-nums",
          onClickUsd2 ? "p-1" : "px-2 py-1"
        )}
        style={{ fontSize: 16 + zoomLevel }}
      >
        <ClickableCell onClick={onClickUsd2} isSelected={isUsd2Selected} className="px-2">
          {usd2 ?? (
            onClickUsd2 ? (
              <span className="text-muted-foreground/30 text-sm select-none">—</span>
            ) : (
              <span className="text-muted-foreground/30 text-[10px] uppercase tracking-wider select-none">Not editable</span>
            )
          )}
        </ClickableCell>
      </div>
    </div>
  );
}
