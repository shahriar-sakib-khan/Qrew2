import { Button } from "@/components/ui/button";
import { Delete, Undo2, Redo2 } from "lucide-react";
import { OPERATORS } from "../formula-bar-types";
import { cn } from "@/lib/utils";

export function FormulaActions({
  isActive,
  historyIndex,
  historyLength,
  onUndo,
  onRedo,
  onInsertChar,
  onDeleteWord,
}: {
  isActive: boolean;
  historyIndex: number;
  historyLength: number;
  onUndo: (e: React.MouseEvent) => void;
  onRedo: (e: React.MouseEvent) => void;
  onInsertChar: (e: React.MouseEvent, char: string) => void;
  onDeleteWord: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 mb-1 transition-opacity duration-200",
        isActive ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Row 1: Numbers */}
      <div className="flex flex-wrap items-center gap-1">
        {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].map((char) => (
          <Button
            key={char}
            variant="ghost"
            size="sm"
            className="h-7 px-2 min-w-[28px] flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            onMouseDown={(e) => onInsertChar(e, char)}
          >
            {char}
          </Button>
        ))}
      </div>

      {/* Row 2: Operators & Actions */}
      <div className="flex flex-wrap items-center gap-1">
        {OPERATORS.map((op) => (
          <Button
            key={op.label}
            variant="ghost"
            size="sm"
            className="h-7 px-2 min-w-[28px] flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={op.title}
            onMouseDown={(e) => {
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent("insert-token", { detail: op.label })
              );
            }}
          >
            {op.label}
          </Button>
        ))}

        <div className="w-[1px] h-4 bg-border mx-1 hidden sm:block" />

        <Button
          variant="ghost"
          size="sm"
          disabled={historyIndex <= 0}
          className="h-7 px-2 min-w-[28px] flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Undo"
          onMouseDown={onUndo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={historyIndex >= historyLength - 1}
          className="h-7 px-2 min-w-[28px] flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Redo"
          onMouseDown={onRedo}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>

        <div className="w-[1px] h-4 bg-border mx-1 hidden sm:block" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 min-w-[28px] flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-xs text-muted-foreground hover:text-destructive transition-colors"
          title="Backspace (Deletes whole token/operator/number)"
          onMouseDown={onDeleteWord}
        >
          <Delete className="h-3.5 w-3.5" />
        </Button>

        <span className="text-[10px] text-muted-foreground/30 select-none hidden 2xl:block ml-2">
          type a token name to autocomplete · Tab/Enter to insert
        </span>
      </div>
    </div>
  );
}
