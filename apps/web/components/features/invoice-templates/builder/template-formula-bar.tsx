"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useBuilderContext, type SelectedCell } from "./builder-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the input string looks like a formula expression
 *  (contains uppercase token-like identifiers, not just a plain number). */
function detectFormula(input: string): boolean {
  const bare = input.trim().replace(/^=\s*/, "");
  // A plain number (optionally with decimals/negation) → not a formula
  if (/^-?\d+(\.\d+)?$/.test(bare)) return false;
  // Contains uppercase word with 3+ chars → treat as formula
  return /[A-Z_]{3,}/.test(bare);
}

function stripLeadingEquals(s: string): string {
  return s.trim().startsWith("=") ? s.trim().slice(1).trim() : s.trim();
}

// ─── Save mutation ────────────────────────────────────────────────────────────

function useSaveCellMutation() {
  const queryClient = useQueryClient();
  const { setSelectedCell } = useBuilderContext();

  return useMutation({
    mutationFn: async ({
      cell,
      rawInput,
    }: {
      cell: SelectedCell;
      rawInput: string;
    }) => {
      const trimmed = rawInput.trim();
      const isFormula = detectFormula(trimmed);
      const formulaValue = stripLeadingEquals(trimmed);

      // Build the PATCH payload for the row-level value fields
      const payload: Record<string, any> = {
        valueType: isFormula ? "formula" : "normal",
        formula: isFormula ? formulaValue : null,
        initialValue: isFormula ? null : (parseFloat(formulaValue) || null),
      };

      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${cell.templateId}/sections/${cell.sectionId}/rows/${cell.rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      return { json: await res.json(), templateId: cell.templateId };
    },
    onSuccess: ({ templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["template-sections", templateId] });
      setSelectedCell(null);
    },
    onError: () => toast.error("Failed to save cell value"),
  });
}

// ─── Token autocomplete ───────────────────────────────────────────────────────

type AutocompleteState = {
  items: string[];
  activeIdx: number;
};

function useAutocomplete(
  inputValue: string,
  tokenMap: Record<string, number>
): {
  state: AutocompleteState;
  setActiveIdx: (i: number) => void;
  isVisible: boolean;
  lastWord: string;
} {
  const [state, setState] = useState<AutocompleteState>({ items: [], activeIdx: 0 });

  const lastWord =
    inputValue
      .replace(/^=\s*/, "")
      .split(/[\s\+\-\*\/\(\),]+/)
      .pop()
      ?.toUpperCase() ?? "";

  const isVisible = lastWord.length >= 2 && state.items.length > 0;

  useEffect(() => {
    if (lastWord.length < 2) {
      setState({ items: [], activeIdx: 0 });
      return;
    }
    const matches = Object.keys(tokenMap)
      .filter((t) => t.startsWith(lastWord))
      .sort()
      .slice(0, 9);
    setState({ items: matches, activeIdx: 0 });
  }, [lastWord, tokenMap]);

  const setActiveIdx = (i: number) =>
    setState((prev) => ({ ...prev, activeIdx: i }));

  return { state, setActiveIdx, isVisible, lastWord };
}

// ─── Formula Bar ──────────────────────────────────────────────────────────────

export function TemplateFormulaBar() {
  const { selectedCell, setSelectedCell, tokenMap } = useBuilderContext();
  const saveMutation = useSaveCellMutation();

  const [inputValue, setInputValue] = useState("");
  const isDirty = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCellRef = useRef(selectedCell);
  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  const { state: ac, setActiveIdx, isVisible: acVisible, lastWord } =
    useAutocomplete(inputValue, tokenMap);

  // ── Sync input when selection changes ──────────────────────────────────────
  useEffect(() => {
    setInputValue(selectedCell?.currentInput ?? "");
    isDirty.current = false;
  }, [selectedCell]);

  // ── Listen for token insertions from the token pool ───────────────────────
  useEffect(() => {
    const handleInsertToken = (e: any) => {
      if (!selectedCellRef.current) return;
      
      const tokenToInsert = e.detail;
      setInputValue((prev) => {
        const base = prev ?? "";
        // If there is no equals sign at the start, optionally prepend one? 
        // We'll just append it. If they are building a formula, they probably already typed '='.
        // But for better UX, if it's empty, we could start with '=' + token.
        if (base === "") return "=" + tokenToInsert;
        return base + tokenToInsert;
      });
      isDirty.current = true;
      inputRef.current?.focus();
    };
    
    window.addEventListener("insert-token", handleInsertToken);
    return () => window.removeEventListener("insert-token", handleInsertToken);
  }, []);

  // ── Auto-focus when a cell is selected ────────────────────────────────────
  useEffect(() => {
    if (selectedCell) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [selectedCell?.rowId]);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedCell) return;
    if (!isDirty.current) {
      setSelectedCell(null);
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed === "" || trimmed === selectedCell.currentInput) {
      setSelectedCell(null);
      return;
    }
    saveMutation.mutate({ cell: selectedCell, rawInput: trimmed });
  }, [selectedCell, inputValue, saveMutation, setSelectedCell]);

  // ── Insert autocomplete token at cursor ────────────────────────────────────
  const insertToken = useCallback(
    (token: string) => {
      if (!inputRef.current) return;
      const cursor = inputRef.current.selectionStart ?? inputValue.length;
      const before = inputValue.slice(0, cursor);
      const after = inputValue.slice(cursor);
      // Replace the partial word with the full token
      const withoutPartial = before.slice(
        0,
        before.length - lastWord.length
      );
      const newValue = withoutPartial + token + after;
      setInputValue(newValue);
      isDirty.current = true;
      setTimeout(() => {
        inputRef.current?.focus();
        const pos = withoutPartial.length + token.length;
        inputRef.current?.setSelectionRange(pos, pos);
      }, 0);
    },
    [inputValue, lastWord]
  );

  // ── Keyboard handling ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (acVisible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(Math.min(ac.activeIdx + 1, ac.items.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(Math.max(ac.activeIdx - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && acVisible)) {
        e.preventDefault();
        insertToken(ac.items[ac.activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // just close autocomplete
        setInputValue(inputValue); // force re-render to close
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSelectedCell(null);
      isDirty.current = false;
    }
  };

  const isActive = !!selectedCell;
  const isPending = saveMutation.isPending;

  // ── Detect formula to style input ─────────────────────────────────────────
  const isFormulaInput =
    inputValue.trim().startsWith("=") || detectFormula(inputValue);

  return (
    <div className="flex flex-col w-full sticky top-0 z-30">
      {/* ── Operator Buttons ── */}
      <div 
        className={cn(
          "flex items-center gap-1 mb-1 transition-opacity duration-200",
          isActive ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {["+", "-", "*", "/"].map((op) => (
          <button
            key={op}
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus in input
              window.dispatchEvent(new CustomEvent("insert-token", { detail: ` ${op} ` }));
            }}
            className="w-7 h-7 flex items-center justify-center rounded bg-card/50 hover:bg-card border border-border/50 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={`Insert ${op}`}
          >
            {op}
          </button>
        ))}
      </div>

      {/* ── Formula Input ── */}
      <div
        className={cn(
          "flex items-stretch border border-b-0 border-border bg-background transition-all duration-150",
          isActive
            ? "ring-1 ring-inset ring-primary/40 bg-primary/[0.015]"
            : "bg-muted/10"
        )}
        style={{ height: 36 }}
      >
        {/* ── Left: ƒx label + breadcrumb ────────────────────────────────── */}
      <div className="w-12 sm:w-48 md:w-52 shrink-0 flex items-center gap-2 px-2 sm:px-3 border-r border-border bg-muted/30">
        <span
          className="text-sm font-bold select-none shrink-0"
          style={{ color: isActive ? "#a78bfa" : undefined }}
        >
          ƒx
        </span>
        {isActive ? (
          <span
            className="hidden sm:inline text-xs text-foreground/70 truncate font-medium"
            title={selectedCell.breadcrumb}
          >
            {selectedCell.breadcrumb}
          </span>
        ) : (
          <span className="hidden sm:inline text-xs text-muted-foreground/30 italic truncate">
            no cell selected
          </span>
        )}
      </div>

      {/* ── Right: formula input ────────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            isDirty.current = true;
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay slightly to allow autocomplete onMouseDown or save/cancel clicks to fire first
            setTimeout(() => {
              const currentSel = selectedCellRef.current;
              if (
                currentSel &&
                currentSel.rowId === selectedCell?.rowId
              ) {
                if (isDirty.current) {
                  handleSave();
                } else {
                  setSelectedCell(null);
                }
              }
            }, 180);
          }}
          disabled={!isActive || isPending}
          placeholder={
            isActive
              ? "Enter value (e.g. 1000) or formula (e.g. = PORT_DUES_TOTAL * 0.1)…"
              : "Click any value cell to edit…"
          }
          className={cn(
            "w-full h-full px-3 bg-transparent border-none outline-none text-sm",
            isFormulaInput && isActive
              ? "font-mono text-violet-400"
              : "font-mono text-foreground",
            !isActive && "text-muted-foreground/30 placeholder:font-sans",
            isPending && "opacity-40"
          )}
          spellCheck={false}
          autoComplete="off"
        />

        {/* ── Autocomplete dropdown ──────────────────────────────────── */}
        {acVisible && (
          <div className="absolute top-full left-0 z-50 w-80 bg-popover border border-border rounded-b-md shadow-xl overflow-hidden">
            <div className="px-3 py-1 border-b border-border/40 bg-muted/20">
              <span className="text-[10px] font-mono text-muted-foreground/50 select-none">
                ↑↓ navigate · Tab/Enter insert · Esc close
              </span>
            </div>
            {ac.items.map((token, i) => {
              const val = tokenMap[token];
              const display =
                val == null
                  ? "—"
                  : val % 1 === 0
                  ? String(val)
                  : val.toFixed(2);
              return (
                <button
                  key={token}
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left",
                    "hover:bg-muted/20 transition-colors",
                    i === ac.activeIdx && "bg-primary/10"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur on input
                    insertToken(token);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <span className="font-mono text-xs text-foreground/80 truncate">
                    {token}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/50 shrink-0">
                    {display}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Saving indicator ────────────────────────────────────────────── */}
      {isPending && (
        <div className="flex items-center gap-1.5 px-3 shrink-0 text-xs text-muted-foreground/50">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving
        </div>
      )}

      {/* ── Save/Cancel buttons when active ────────────────────────────── */}
      {isActive && !isPending && (
        <div className="flex items-center px-3 shrink-0 gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 group cursor-pointer animate-in fade-in zoom-in-95 duration-100"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 text-muted-foreground/50 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary transition-all font-mono">
              Enter
            </kbd>
            <span className="text-[10px] text-muted-foreground/40 group-hover:text-primary transition-colors">
              save
            </span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 group cursor-pointer animate-in fade-in zoom-in-95 duration-100"
            onMouseDown={(e) => {
              e.preventDefault();
              isDirty.current = false;
              setSelectedCell(null);
            }}
          >
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 text-muted-foreground/50 group-hover:border-destructive/40 group-hover:bg-destructive/5 group-hover:text-destructive transition-all font-mono">
              Esc
            </kbd>
            <span className="text-[10px] text-muted-foreground/40 group-hover:text-destructive transition-colors">
              cancel
            </span>
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
