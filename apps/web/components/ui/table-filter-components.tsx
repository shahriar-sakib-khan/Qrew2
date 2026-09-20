"use client";

import { Check, ChevronDown, X } from "lucide-react";
import type React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface FilterableTableHeaderProps {
  columnKey: string;
  title: React.ReactNode;
  isFiltered: boolean;
  activeValue?: string;
  onClear: () => void;
  options?: { label: string; value: string }[];
  onSelectOption?: (columnKey: string, value: string) => void;
  width?: number;
  resizable?: boolean;
  onResizeStart?: (columnKey: string, e: React.MouseEvent) => void;
  onResetWidth?: (columnKey: string) => void;
  className?: string;
}

export function FilterableTableHeader({
  columnKey,
  title,
  isFiltered,
  activeValue,
  onClear,
  options,
  onSelectOption,
  width,
  resizable = true,
  onResizeStart,
  onResetWidth,
  className,
}: FilterableTableHeaderProps) {
  const widthStyle: React.CSSProperties | undefined = width
    ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }
    : undefined;

  return (
    <TableHead style={widthStyle} className={cn("relative select-none pr-8 group/head", className)}>
      <div className="flex items-center gap-1 w-full overflow-hidden">
        {options && options.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 py-1 px-1 -ml-1 rounded hover:bg-muted/80 transition-colors text-left focus:outline-none max-w-full overflow-hidden",
                  isFiltered && "text-primary font-bold",
                )}
                title={`Filter by ${typeof title === "string" ? title : columnKey}`}
              >
                <span className="truncate font-medium">{title}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-48">
              {options.map((opt) => {
                const isSelected = activeValue?.toLowerCase() === opt.value.toLowerCase();
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSelectOption?.(columnKey, opt.value)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span
            className={cn(
              "truncate font-medium transition-colors",
              isFiltered && "text-primary font-bold",
            )}
          >
            {title}
          </span>
        )}
      </div>

      {/* Absolutely positioned clear [X] button so it NEVER affects header column width */}
      {isFiltered && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-primary/20 text-primary transition-colors focus:outline-none z-10"
          title={`Clear filter for ${typeof title === "string" ? title : columnKey}`}
          aria-label={`Clear filter for ${typeof title === "string" ? title : columnKey}`}
        >
          <X className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      )}

      {/* Resizer Vertical Handle Line: Desktop only (hidden on mobile) */}
      {resizable && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(columnKey, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResetWidth?.(columnKey);
          }}
          className="hidden md:block absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/70 active:bg-primary z-20 transition-colors group-hover/head:bg-border/60"
          title="Drag to resize column (Double-click to reset)"
        />
      )}
    </TableHead>
  );
}

interface FilterableTableCellProps {
  columnKey: string;
  value: string;
  isFiltered: boolean;
  onToggleFilter: (columnKey: string, value: string) => void;
  onTextClick?: (e: React.MouseEvent) => void;
  width?: number;
  children: React.ReactNode;
  className?: string;
}

export function FilterableTableCell({
  columnKey,
  value,
  isFiltered,
  onToggleFilter,
  onTextClick,
  width,
  children,
  className,
}: FilterableTableCellProps) {
  const widthStyle: React.CSSProperties | undefined = width
    ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }
    : undefined;

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value || value === "-") return;
    onToggleFilter(columnKey, value);
  };

  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTextClick) {
      onTextClick(e);
    } else if (value && value !== "-") {
      onToggleFilter(columnKey, value);
    }
  };

  return (
    <TableCell
      style={widthStyle}
      onClick={handleCellClick}
      className={cn(
        "relative transition-colors cursor-pointer select-none group/cell",
        "hover:bg-accent/30 dark:hover:bg-accent/20",
        isFiltered && "bg-primary/5 dark:bg-primary/10",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 max-w-full">
        <span
          onClick={handleTextClick}
          className={cn(
            "transition-colors duration-150 inline-flex items-center gap-1.5 truncate max-w-full font-normal",
            onTextClick &&
              "hover:underline hover:text-primary cursor-pointer decoration-primary/70 underline-offset-4",
            isFiltered && "text-primary font-medium",
          )}
        >
          {children}
        </span>
      </div>
    </TableCell>
  );
}
