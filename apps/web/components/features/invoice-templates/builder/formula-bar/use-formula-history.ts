import { useCallback, useEffect, useRef, useState } from "react";

export function useFormulaHistory(inputValue: string, setInputValue: (v: string) => void) {
  const [hist, setHist] = useState({ items: [] as string[], index: -1 });
  const isUndoRedo = useRef(false);

  useEffect(() => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }

    setHist((prev) => {
      if (prev.items[prev.index] === inputValue) return prev;
      const truncated = prev.items.slice(0, prev.index + 1);
      return {
        items: [...truncated, inputValue],
        index: truncated.length,
      };
    });
  }, [inputValue]);

  const undo = useCallback(
    (inputRef: React.RefObject<any>, isDirty: React.MutableRefObject<boolean>) => {
      setHist((prev) => {
        if (prev.index > 0) {
          isUndoRedo.current = true;
          const newIdx = prev.index - 1;
          setInputValue(prev.items[newIdx]);
          isDirty.current = true;

          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              const len = prev.items[newIdx].length;
              inputRef.current.setSelectionRange(len, len);
            }
          }, 0);
          return { ...prev, index: newIdx };
        }
        return prev;
      });
    },
    [setInputValue],
  );

  const redo = useCallback(
    (inputRef: React.RefObject<any>, isDirty: React.MutableRefObject<boolean>) => {
      setHist((prev) => {
        if (prev.index < prev.items.length - 1) {
          isUndoRedo.current = true;
          const newIdx = prev.index + 1;
          setInputValue(prev.items[newIdx]);
          isDirty.current = true;

          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              const len = prev.items[newIdx].length;
              inputRef.current.setSelectionRange(len, len);
            }
          }, 0);
          return { ...prev, index: newIdx };
        }
        return prev;
      });
    },
    [setInputValue],
  );

  const resetHistory = useCallback((initialValue: string) => {
    isUndoRedo.current = true;
    setHist({ items: [initialValue], index: 0 });
  }, []);

  const markUndoRedo = useCallback(() => {
    isUndoRedo.current = true;
  }, []);

  return { history: hist.items, historyIndex: hist.index, undo, redo, resetHistory, markUndoRedo };
}
