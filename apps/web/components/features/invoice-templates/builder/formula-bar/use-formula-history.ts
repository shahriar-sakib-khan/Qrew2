import { useState, useRef, useEffect, useCallback } from "react";

export function useFormulaHistory(inputValue: string, setInputValue: (v: string) => void) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedo = useRef(false);

  useEffect(() => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }
    setHistory((h) => {
      const truncated = h.slice(0, historyIndex + 1);
      if (truncated[truncated.length - 1] === inputValue) return truncated;
      return [...truncated, inputValue];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [inputValue, historyIndex]);

  const undo = useCallback((inputRef: React.RefObject<any>, isDirty: React.MutableRefObject<boolean>) => {
    if (historyIndex > 0) {
      isUndoRedo.current = true;
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setInputValue(history[newIdx]);
      isDirty.current = true;
      inputRef.current?.focus();
    }
  }, [history, historyIndex, setInputValue]);

  const redo = useCallback((inputRef: React.RefObject<any>, isDirty: React.MutableRefObject<boolean>) => {
    if (historyIndex < history.length - 1) {
      isUndoRedo.current = true;
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setInputValue(history[newIdx]);
      isDirty.current = true;
      inputRef.current?.focus();
    }
  }, [history, historyIndex, setInputValue]);

  const resetHistory = useCallback((initialValue: string) => {
    isUndoRedo.current = true;
    setHistory([initialValue]);
    setHistoryIndex(0);
  }, []);

  const markUndoRedo = useCallback(() => {
    isUndoRedo.current = true;
  }, []);

  return { history, historyIndex, undo, redo, resetHistory, markUndoRedo };
}
