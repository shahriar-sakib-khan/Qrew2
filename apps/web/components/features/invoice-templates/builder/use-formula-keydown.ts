"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getLastWord } from "./formula-bar-utils";
import type { SelectedCell } from "./builder-context";

export interface UseFormulaKeyDownProps {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  isDirty: React.MutableRefObject<boolean>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  allTokens: string[];
  acVisible: boolean;
  ac: { items: string[]; activeIdx: number };
  insertToken: (token: string) => void;
  setActiveIdx: (i: number) => void;
  setAcState: React.Dispatch<React.SetStateAction<{ items: string[]; activeIdx: number }>>;
  handleSave: () => void;
  setSelectedCell: (cell: SelectedCell | null) => void;
}

export function useFormulaKeyDown({
  inputValue,
  setInputValue,
  isDirty,
  inputRef,
  allTokens,
  acVisible,
  ac,
  insertToken,
  setActiveIdx,
  setAcState,
  handleSave,
  setSelectedCell,
  invalidTokens = new Set<string>(),
}: UseFormulaKeyDownProps & { invalidTokens?: Set<string> }) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // ── Autocomplete navigation ──
      if (acVisible) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          // Find next valid index
          let nextIdx = ac.activeIdx + 1;
          while (nextIdx < ac.items.length && invalidTokens.has(ac.items[nextIdx])) {
             nextIdx++;
          }
          if (nextIdx < ac.items.length) setActiveIdx(nextIdx);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          // Find prev valid index
          let prevIdx = ac.activeIdx - 1;
          while (prevIdx >= 0 && invalidTokens.has(ac.items[prevIdx])) {
             prevIdx--;
          }
          if (prevIdx >= 0) setActiveIdx(prevIdx);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const item = ac.items[ac.activeIdx];
          if (item && !invalidTokens.has(item)) insertToken(item);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAcState((prev) => ({ ...prev, items: [] }));
          return;
        }
      }

      if (e.key === "Enter") { e.preventDefault(); handleSave(); return; }
      if (e.key === "Escape") { e.preventDefault(); setSelectedCell(null); isDirty.current = false; return; }

      // Control / navigation keys always pass through (except Backspace which we handle smartly)
      if (
        e.ctrlKey || e.metaKey || e.altKey ||
        e.key === "Delete" ||
        e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" ||
        e.key === "Tab"
      ) return;

      // Smart Backspace: delete spaced operators as a single block
      if (e.key === "Backspace") {
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? 0;
        const selEnd = target.selectionEnd ?? 0;
        if (selStart === selEnd && selStart > 0) {
          const before = inputValue.slice(0, selStart);
          const after = inputValue.slice(selEnd);

          // 1. Match a full spaced operator block " + " / " - " / " * " / " / " / " // " before cursor
          const matchSpaced = before.match(/ (\+|-|\*|\/|\/\/) $/);
          if (matchSpaced) {
            e.preventDefault();
            const toRemove = matchSpaced[0].length;
            const newVal = before.slice(0, -toRemove) + after;
            setInputValue(newVal);
            isDirty.current = true;
            setTimeout(() => inputRef.current?.setSelectionRange(selStart - toRemove, selStart - toRemove), 0);
            return;
          }

          // 2. Match a partial operator (cursor right after operator, trailing space not yet typed)
          const matchPartial = before.match(/ (\+|-|\*|\/|\/\/)$/);
          if (matchPartial) {
            e.preventDefault();
            const toRemove = matchPartial[0].length;
            const newVal = before.slice(0, -toRemove) + after;
            setInputValue(newVal);
            isDirty.current = true;
            setTimeout(() => inputRef.current?.setSelectionRange(selStart - toRemove, selStart - toRemove), 0);
            return;
          }

          // 3. Trailing space after ) — delete both the space and the ) as a pair
          if (before.endsWith(") ")) {
            e.preventDefault();
            const newVal = before.slice(0, -2) + after;
            setInputValue(newVal);
            isDirty.current = true;
            setTimeout(() => inputRef.current?.setSelectionRange(selStart - 2, selStart - 2), 0);
            return;
          }

          // 4. Any other trailing space — let native backspace handle it!
          // This allows users to delete anomalous spaces (e.g. from old formulas) without getting stuck.
          if (before.endsWith(" ")) {
            return;
          }
        }
        return; // let normal backspace pass through otherwise
      }

      // Block manual Delete of spaces
      if (e.key === "Delete") {
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const selEnd = target.selectionEnd ?? inputValue.length;
        if (selStart === selEnd && selStart < inputValue.length) {
          if (inputValue[selStart] === " ") {
            e.preventDefault();
            return;
          }
        }
        return;
      }

      // Space: convert to underscore if it matches a token prefix, otherwise block
      if (e.key === " ") {
        e.preventDefault();
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const before = inputValue.slice(0, selStart);
        const currentLastWord = getLastWord(before);

        if (!currentLastWord || before.endsWith("_")) return;

        const candidate = currentLastWord + "_";
        const hasMatches = allTokens.some(
          (t) => t.startsWith(candidate) || t.includes("_" + candidate)
        );

        if (hasMatches) {
          const selEnd = target.selectionEnd ?? inputValue.length;
          const newVal = before + "_" + inputValue.slice(selEnd);
          setInputValue(newVal);
          isDirty.current = true;
          setTimeout(() => inputRef.current?.setSelectionRange(selStart + 1, selStart + 1), 0);
        }
        return;
      }

      // Explicit underscore
      if (e.key === "_") {
        e.preventDefault();
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const before = inputValue.slice(0, selStart);
        const currentLastWord = getLastWord(before);

        if (!currentLastWord || before.endsWith("_")) return;

        const candidate = currentLastWord + "_";
        const hasMatches = allTokens.some(
          (t) => t.startsWith(candidate) || t.includes("_" + candidate)
        );

        if (hasMatches) {
          const selEnd = target.selectionEnd ?? inputValue.length;
          const newVal = before + "_" + inputValue.slice(selEnd);
          setInputValue(newVal);
          isDirty.current = true;
          setTimeout(() => inputRef.current?.setSelectionRange(selStart + 1, selStart + 1), 0);
        }
        return;
      }

      // Bug A fix: if cursor follows a token-trailing space (TOKEN + space, no operator), block new letters/digits
      if (/^[a-zA-Z0-9.]$/.test(e.key)) {
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const before = inputValue.slice(0, selStart);
        if (before.endsWith(" ")) {
          const trimmedB = before.trimEnd();
          const lastChar = trimmedB[trimmedB.length - 1];
          if (lastChar && /[A-Z0-9_)]/.test(lastChar)) {
            e.preventDefault();
            toast.error("Add an operator before typing a value.");
            return;
          }
        }
      }

      // Digit or decimal: allowed (if it passed the space check)
      if (/^[0-9.]$/.test(e.key)) return;

      // Prevent typing unmatched closing parenthesis
      if (e.key === ")") {
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const before = inputValue.slice(0, selStart);
        const openCount = (before.match(/\(/g) || []).length;
        const closeCount = (before.match(/\)/g) || []).length;

        if (closeCount >= openCount) {
          e.preventDefault();
          toast.error("Cannot add closing parenthesis (no open pair)");
          return;
        }
        // ) is valid — let it pass through natively
        return;
      }

      // Operator characters
      if (["+", "-", "*", "/", "%", "(", ")"].includes(e.key)) {
        if (["+", "-", "*", "/"].includes(e.key)) {
          e.preventDefault();
          const target = e.target as HTMLInputElement;
          const selStart = target.selectionStart ?? inputValue.length;
          const selEnd = target.selectionEnd ?? inputValue.length;
          const before = inputValue.slice(0, selStart);
          const after = inputValue.slice(selEnd);

          // Block operator if current last word is an incomplete token
          const trimmedBefore = before.trimEnd();
          const lastWordMatch = trimmedBefore.match(/[A-Z0-9_]+$/);
          const lastWordInBuf = lastWordMatch ? lastWordMatch[0] : "";
          if (lastWordInBuf && !allTokens.includes(lastWordInBuf) && !/^[0-9.]+$/.test(lastWordInBuf)) {
            toast.error(`"${lastWordInBuf}" is not a complete token. Finish the token before adding an operator.`);
            return;
          }

          // Bug B fix: block consecutive operators
          // (The `//` case is handled below — second `/` converts " / " → " // ")
          const lastMeaningfulChar = trimmedBefore[trimmedBefore.length - 1];
          // Only block if it's NOT the second `/` that would form `//`
          const wouldFormDoubleSlash = e.key === "/" && before.endsWith(" / ");
          if (!wouldFormDoubleSlash && lastMeaningfulChar && /[+\-*\/%]/.test(lastMeaningfulChar)) {
            // Consecutive operators — silent reject
            return;
          }

          // Handle `//`
          if (e.key === "/" && before.endsWith(" / ")) {
            const newVal = before.slice(0, -3) + " // " + after;
            setInputValue(newVal);
            isDirty.current = true;
            setTimeout(() => inputRef.current?.setSelectionRange(selStart + 1, selStart + 1), 0);
            return;
          }

          const padLeft = before.endsWith(" ") || before === "" || before.endsWith("(") ? "" : " ";
          const padRight = after.startsWith(" ") ? "" : " ";

          const newVal = before + padLeft + e.key + padRight + after;
          setInputValue(newVal);
          isDirty.current = true;

          setTimeout(() => {
            const newPos = before.length + padLeft.length + 1 + padRight.length;
            inputRef.current?.setSelectionRange(newPos, newPos);
          }, 0);
          return;
        }

        // ── Open parenthesis: gated insertion ──
        if (e.key === "(") {
          e.preventDefault();
          const target = e.target as HTMLInputElement;
          const selStart = target.selectionStart ?? inputValue.length;
          const selEnd = target.selectionEnd ?? inputValue.length;
          const before = inputValue.slice(0, selStart);
          const after = inputValue.slice(selEnd);
          const trimmedBefore = before.trimEnd();
          const lastWordMatch = trimmedBefore.match(/[A-Z0-9_]+$/);
          const lastWordInBuf = lastWordMatch ? lastWordMatch[0] : "";

          // Block ( after incomplete token
          if (lastWordInBuf && !allTokens.includes(lastWordInBuf) && !/^[0-9.]+$/.test(lastWordInBuf)) {
            toast.error(`"${lastWordInBuf}" is not a complete token. Finish the token before adding (.`);
            return;
          }
          // Block ( directly after a complete token or number (needs operator in between)
          const lastActualChar = trimmedBefore[trimmedBefore.length - 1];
          if (lastActualChar && /[A-Z0-9_)]/.test(lastActualChar)) {
            toast.error("Add an operator before opening a parenthesis after a token or number.");
            return;
          }

          const prefix = before.endsWith(" ") || before === "" ? "" : " ";
          const newVal = before + prefix + "(" + after;
          setInputValue(newVal);
          isDirty.current = true;
          setTimeout(() => {
            const newPos = before.length + prefix.length + 1;
            inputRef.current?.setSelectionRange(newPos, newPos);
          }, 0);
          return;
        }

        // ── Percentage: gated (block after incomplete token AND after complete token/word char) ──
        if (e.key === "%") {
          const target = e.target as HTMLInputElement;
          const selStart = target.selectionStart ?? inputValue.length;
          const before = inputValue.slice(0, selStart);
          const trimmedBefore = before.trimEnd();
          const lastWordMatch = trimmedBefore.match(/[A-Z0-9_]+$/);
          const lastWordInBuf = lastWordMatch ? lastWordMatch[0] : "";

          // Bug D fix: block % after any complete token (word chars ending with letters/underscore)
          if (lastWordInBuf) {
            if (!allTokens.includes(lastWordInBuf) && !/^[0-9.]+$/.test(lastWordInBuf)) {
              // Incomplete token
              e.preventDefault();
              toast.error(`"${lastWordInBuf}" is not a complete token. Finish the token before adding %.`);
              return;
            }
            // Complete token but % is not valid after a token (only after numbers)
            if (allTokens.includes(lastWordInBuf)) {
              e.preventDefault();
              return; // silent reject — % is only valid after numbers
            }
          }
          // Let % pass through natively (valid after a number like 50%)
          return;
        }

        // ── Close parenthesis passes through (already checked above) ──
        return;
      }

      // Letter typing: validate against active tokens with auto-capitalization & auto-underscore
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const upper = e.key.toUpperCase();
        const target = e.target as HTMLInputElement;
        const selStart = target.selectionStart ?? inputValue.length;
        const selEnd = target.selectionEnd ?? inputValue.length;
        const before = inputValue.slice(0, selStart);
        const after = inputValue.slice(selEnd);
        const currentLastWord = getLastWord(before);

        // Path A: Direct continuation (e.g. typing "P", "PO", "PORT")
        const directCandidate = currentLastWord ? currentLastWord + upper : upper;
        const hasDirectMatch = allTokens.some(
          (t) =>
            t.startsWith(directCandidate) ||
            t.includes("_" + directCandidate) ||
            t.includes(directCandidate)
        );

        if (hasDirectMatch) {
          const newVal = before + upper + after;
          setInputValue(newVal);
          isDirty.current = true;
          setTimeout(() => inputRef.current?.setSelectionRange(selStart + 1, selStart + 1), 0);
          return;
        }

        // Path B: Missing underscore auto-insertion
        if (currentLastWord && !before.endsWith("_")) {
          const autoUnderscoreCandidate = currentLastWord + "_" + upper;
          const hasUnderscoreMatch = allTokens.some(
            (t) =>
              t.startsWith(autoUnderscoreCandidate) ||
              t.includes("_" + autoUnderscoreCandidate) ||
              t.includes(autoUnderscoreCandidate)
          );

          if (hasUnderscoreMatch) {
            const newVal = before + "_" + upper + after;
            setInputValue(newVal);
            isDirty.current = true;
            setTimeout(() => inputRef.current?.setSelectionRange(selStart + 2, selStart + 2), 0);
            return;
          }
        }

        // Keystroke does not match any token path -> reject
        return;
      }

      // Anything else → reject
      e.preventDefault();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acVisible, ac, setActiveIdx, insertToken, setAcState, handleSave, setSelectedCell, inputValue, allTokens]
  );
}
