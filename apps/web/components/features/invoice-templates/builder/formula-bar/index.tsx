"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { useBuilderContext } from "../builder-context";
import { validateFormulaSave } from "../formula-bar-utils";
import { SyntaxOverlay, renderHighlightedToken } from "../formula-bar-syntax";
import { useFormulaAutocomplete } from "../use-formula-autocomplete";
import { useSaveCellMutation } from "../use-save-cell";
import { useFormulaKeyDown } from "../use-formula-keydown";
import { getTransitiveDependents } from "@/lib/formula-evaluator";
import { useFormulaHistory } from "./use-formula-history";
import { FormulaActions } from "./formula-actions";

export function TemplateFormulaBar() {
  const { selectedCell, setSelectedCell, tokenMap, sections } = useBuilderContext();
  const saveMutation = useSaveCellMutation();

  const [inputValue, setInputValue] = useState("");
  const { history, historyIndex, undo, redo, resetHistory, markUndoRedo } = useFormulaHistory(inputValue, setInputValue);

  const isDirty = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const selectedCellRef = useRef(selectedCell);
  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  const isActive = !!selectedCell;
  const isPending = saveMutation.isPending;

  const hiddenTokens = useMemo(() => {
    const set = new Set<string>();
    if (selectedCell?.sectionId) {
      const sec = sections.find(s => s.id === selectedCell.sectionId);
      if (sec) {
        set.add(`SEC_${sec.sectionToken}`);
        set.add(`SEC_${sec.sectionToken}_CHARGES`);
        set.add(`SEC_${sec.sectionToken}_TOTAL`);
      }
    }
    return set;
  }, [selectedCell?.sectionId, sections]);

  const invalidTokens = useMemo(() => {
    if (!selectedCell?.token) return new Set<string>();
    return getTransitiveDependents(selectedCell.token, sections);
  }, [selectedCell?.token, sections]);

  const { state: ac, setState: setAcState, setActiveIdx, isVisible: acVisible, lastWord, allTokens } =
    useFormulaAutocomplete(inputValue, tokenMap, isActive, selectedCell?.token, invalidTokens, hiddenTokens);

  const allTokensRef = useRef<string[]>(allTokens);
  useEffect(() => {
    allTokensRef.current = allTokens;
  }, [allTokens]);

  const isFormulaInput = selectedCell?.valueType === "formula";

  useEffect(() => {
    const initial = selectedCell?.currentInput ?? "";
    resetHistory(initial);
    setInputValue(initial);
    isDirty.current = false;
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, [selectedCell, resetHistory]);

  useEffect(() => {
    const handleInsertToken = (e: any) => {
      if (!selectedCellRef.current) return;
      const tokenToInsert: string = e.detail.trim();

      setInputValue((prev) => {
        const base = prev ?? "";
        const trimmedBase = base.trimEnd();
        const lastChar = trimmedBase[trimmedBase.length - 1];

        if (tokenToInsert === ")") {
          const openCount = (base.match(/\(/g) || []).length;
          const closeCount = (base.match(/\)/g) || []).length;
          if (closeCount >= openCount) {
            toast.error("Cannot add closing parenthesis (no open pair)");
            return prev;
          }
        }

        const isBinaryOp = ["+", "-", "*", "/", "%", "//"].includes(tokenToInsert);
        const isOpenParen = tokenToInsert === "(";
        const isCloseParen = tokenToInsert === ")";
        const isOp = isBinaryOp || isOpenParen || isCloseParen;

        if (isBinaryOp || isOpenParen) {
          if (trimmedBase.length > 0) {
            const lastWordMatch = trimmedBase.match(/[A-Z0-9_]+$/);
            const lastWordInBuffer = lastWordMatch ? lastWordMatch[0] : "";
            if (lastWordInBuffer && !allTokensRef.current.includes(lastWordInBuffer) && !/^[0-9.]+$/.test(lastWordInBuffer)) {
              toast.error(`"${lastWordInBuffer}" is not a complete token. Finish the token before adding an operator.`);
              return prev;
            }
            if (isOpenParen && lastChar && /[A-Z0-9_)]/.test(lastChar)) {
              toast.error("Add an operator before opening a parenthesis after a token or number.");
              return prev;
            }
          }
          if (isBinaryOp && trimmedBase.length > 0) {
            if (tokenToInsert === "/" && base.endsWith(" / ")) {
              return base.slice(0, -3) + " // ";
            }
            const lastMeaningfulChar = lastChar;
            if (lastMeaningfulChar && /[+\-*\/%]/.test(lastMeaningfulChar)) {
              return prev;
            }
          }
        }

        if (!isOp && trimmedBase.length > 0) {
          if (lastChar && /[A-Za-z0-9_)]/.test(lastChar)) {
            toast.error("Add an operator before inserting another token.");
            return prev;
          }
        }

        if (!isOp && selectedCellRef.current?.token) {
          const currentToken = selectedCellRef.current.token;
          if (tokenToInsert === currentToken || tokenToInsert === `${currentToken}_TOTAL`) {
            toast.error(`Circular reference: a formula cannot reference its own token "${tokenToInsert}"`);
            return prev;
          }
        }

        const prefix = base.endsWith(" ") || base === "" ? "" : " ";
        if (isOpenParen) return base + prefix + tokenToInsert;
        return base + prefix + tokenToInsert + " ";
      });
      isDirty.current = true;
      inputRef.current?.focus();
    };

    window.addEventListener("insert-token", handleInsertToken);
    return () => window.removeEventListener("insert-token", handleInsertToken);
  }, []);

  useEffect(() => {
    if (selectedCell) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [selectedCell?.rowId, selectedCell?.chargeId]);

  const handleSave = useCallback(() => {
    if (!selectedCell || saveMutation.isPending) return;
    if (!isDirty.current) {
      setSelectedCell(null);
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed === selectedCell.currentInput) {
      setSelectedCell(null);
      return;
    }

    if (trimmed !== "" && selectedCell.valueType === "formula") {
      const fullTokenList = Object.keys(tokenMap);
      const error = validateFormulaSave(trimmed, fullTokenList, selectedCell.token);
      if (error) {
        toast.error(error);
        inputRef.current?.focus();
        return;
      }
    }

    saveMutation.mutate({ cell: selectedCell, rawInput: trimmed });
  }, [selectedCell, inputValue, saveMutation, setSelectedCell, tokenMap]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!isActive) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(".formula-bar-container") ||
        target.closest(".token-pool-container") ||
        target.closest(".row-action-trigger") ||
        target.closest(".insertable-token")
      ) {
        return;
      }
      if (isDirty.current) {
        handleSave();
      } else {
        setSelectedCell(null);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [isActive, handleSave, setSelectedCell]);

  const insertToken = useCallback(
    (token: string) => {
      if (!selectedCellRef.current) return;
      const target = inputRef.current;
      const selStart = target?.selectionStart ?? inputValue.length;

      const withoutPartial = inputValue.slice(0, selStart - lastWord.length);
      const afterCursor = inputValue.slice(selStart);

      const padLeft = withoutPartial.endsWith(" ") || withoutPartial === "" || withoutPartial.endsWith("(") ? "" : " ";
      const newVal = withoutPartial + padLeft + token + " " + afterCursor;

      setInputValue(newVal);
      isDirty.current = true;

      setAcState((prev) => ({ ...prev, items: [] }));

      setTimeout(() => {
        inputRef.current?.focus();
        const pos = withoutPartial.length + padLeft.length + token.length + 1;
        inputRef.current?.setSelectionRange(pos, pos);
      }, 0);
    },
    [inputValue, lastWord, setAcState]
  );

  const handleKeyDown = useFormulaKeyDown({
    inputValue,
    setInputValue,
    isDirty,
    inputRef: inputRef as any,
    allTokens,
    acVisible,
    ac,
    insertToken,
    setActiveIdx,
    setAcState,
    handleSave,
    setSelectedCell,
  });

  const handleMouseDeleteWord = (e: React.MouseEvent) => {
    e.preventDefault();
    setInputValue((prev) => {
      if (!prev) return prev;
      const match = prev.match(/([A-Z0-9_.]+)\s*$/);
      if (match) return prev.slice(0, -match[0].length);
      
      const opMatch = prev.match(/([+\-*/%()]+)\s*$/);
      if (opMatch) return prev.slice(0, -opMatch[0].length);

      return prev.slice(0, -1);
    });
    isDirty.current = true;
    inputRef.current?.focus();
  };

  const handleMouseInsertChar = (e: React.MouseEvent, char: string) => {
    e.preventDefault();
    setInputValue((prev) => prev + char);
    isDirty.current = true;
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col w-full sticky top-0 z-30 formula-bar-container">
      <FormulaActions
        isActive={isActive}
        historyIndex={historyIndex}
        historyLength={history.length}
        onUndo={(e) => { e.preventDefault(); undo(inputRef, isDirty); }}
        onRedo={(e) => { e.preventDefault(); redo(inputRef, isDirty); }}
        onInsertChar={handleMouseInsertChar}
        onDeleteWord={handleMouseDeleteWord}
      />

      <div className="relative w-full z-40 shadow-sm" style={{ height: 36 }}>
        <div
          className={cn(
            "absolute top-0 left-0 w-full flex items-stretch border border-border bg-background transition-all duration-150 rounded-md shadow-md",
            isActive
              ? "ring-1 ring-inset ring-primary/40"
              : ""
          )}
          style={{ minHeight: 36 }}
        >
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

        <div className="flex-1 relative flex items-center">
          {isActive && isFormulaInput && (
            <div
              ref={overlayRef}
              className="absolute inset-0 px-3 py-2 pointer-events-none whitespace-pre-wrap break-all overflow-hidden font-mono text-sm"
              aria-hidden="true"
            >
              <SyntaxOverlay value={inputValue} />
            </div>
          )}

          <TextareaAutosize
            ref={inputRef}
            minRows={1}
            maxRows={5}
            value={inputValue}
            onScroll={(e) => {
              if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onChange={(e) => {
              setInputValue(e.target.value.toUpperCase());
              isDirty.current = true;
            }}
            onKeyDown={handleKeyDown as any}
            disabled={!isActive || isPending}
            placeholder={
              isActive
                ? isFormulaInput
                  ? "Type a token (auto-completes) or a number..."
                  : "Type a flat number value..."
                : ""
            }
            className={cn(
              "w-full px-3 py-2 bg-transparent resize-none outline-none font-mono text-sm relative z-10 whitespace-pre-wrap break-all overflow-y-auto",
              isFormulaInput ? "text-transparent caret-foreground" : "text-foreground",
              !isActive && "text-muted-foreground/30 placeholder:font-sans",
              isPending && "opacity-40"
            )}
            spellCheck={false}
            autoComplete="off"
          />

          {acVisible && ac.items.length > 0 && (
            <div className="absolute top-full left-0 z-50 w-80 bg-popover border border-border rounded-b-md shadow-xl overflow-hidden">
              <div className="px-3 py-1 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground/50 select-none">
                  ↑↓ navigate · Tab/Enter insert · Esc close
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/30 select-none">
                  {ac.items.length} token{ac.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {ac.items.map((token, i) => {
                  const val = tokenMap[token];
                  const display =
                    val == null
                      ? "—"
                      : val % 1 === 0
                      ? String(val)
                      : val.toFixed(2);
                  const isInvalid = invalidTokens.has(token);

                  return (
                    <button
                      key={token}
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors relative group/item",
                        isInvalid ? "opacity-50 cursor-not-allowed bg-muted/10" : "hover:bg-muted/20",
                        i === ac.activeIdx && !isInvalid && "bg-primary/10"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isInvalid) insertToken(token);
                      }}
                      onMouseEnter={() => {
                        if (!isInvalid) setActiveIdx(i);
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className={cn("font-mono text-xs truncate min-w-0", isInvalid ? "text-muted-foreground line-through" : "text-foreground/80")}>
                          {renderHighlightedToken(token, lastWord)}
                        </span>
                        {isInvalid && (
                          <div title="Selecting this token would create a circular dependency" className="text-yellow-500 flex items-center shrink min-w-0 gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-[10px] text-yellow-600/80 truncate font-sans">
                              Creates circular dependency
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground/50 shrink-0">
                        {display}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 px-3 shrink-0 text-xs text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving
          </div>
        )}

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
    </div>
  );
}
