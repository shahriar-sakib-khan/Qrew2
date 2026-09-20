"use client";

import { useState, useEffect, useMemo } from "react";
import { getLastWord, lastSegmentIsNumeric } from "./formula-bar-utils";

export function useFormulaAutocomplete(
  inputValue: string,
  tokenMap: Record<string, number>,
  isActive: boolean,
  currentToken?: string,
  invalidTokens: Set<string> = new Set(),
  hiddenTokens: Set<string> = new Set()
) {
  const [state, setState] = useState({
    items: [] as string[],
    activeIdx: 0,
  });
  const [forceHidden, setForceHidden] = useState(false);

  const lastWord = getLastWord(inputValue);
  const numericOnly = lastSegmentIsNumeric(inputValue);

  // Sorted full token list, excluding the current token, its TOTAL variant, and hidden tokens
  const allTokens = useMemo(() => {
    return Object.keys(tokenMap)
      .filter((t) => {
        if (hiddenTokens.has(t)) return false;
        if (!currentToken) return true;
        if (t === currentToken) return false;
        if (t === `${currentToken}_TOTAL`) return false;
        return true;
      })
      .sort();
  }, [tokenMap, currentToken, hiddenTokens]);

  // Reset forceHidden whenever input value changes (user typed something)
  useEffect(() => {
    setForceHidden(false);
  }, [inputValue]);

  // isVisible: show when active, not force-hidden, not in a numeric literal,
  // AND either: typing a letter (lastWord has content) OR at a position where a token would start
  const trimmed = inputValue.trimEnd();
  const atInsertPosition =
    trimmed.length === 0 || /[+\-*/%(]$/.test(trimmed);

  const isVisible =
    isActive &&
    !forceHidden &&
    !numericOnly &&
    (lastWord.length > 0 || atInsertPosition);

  useEffect(() => {
    if (!isActive || numericOnly) {
      setState({ items: [], activeIdx: 0 });
      return;
    }
    if (lastWord.length === 0) {
      setState({ items: allTokens, activeIdx: 0 });
      return;
    }

    const q = lastWord.toUpperCase();
    const qClean = q.replace(/_/g, "");

    const tier1: string[] = []; // Exact prefix match
    const tier2: string[] = []; // Prefix match ignoring underscores
    const tier3: string[] = []; // Word boundary match
    const tier4: string[] = []; // Contains match

    for (const t of allTokens) {
      const tClean = t.replace(/_/g, "");
      if (t.startsWith(q)) {
        tier1.push(t);
      } else if (qClean && tClean.startsWith(qClean)) {
        tier2.push(t);
      } else if (t.split("_").some((part) => part.startsWith(qClean || q))) {
        tier3.push(t);
      } else if (tClean.includes(qClean) || t.includes(q)) {
        tier4.push(t);
      }
    }

    const seen = new Set<string>();
    const ranked: string[] = [];
    for (const item of [...tier1, ...tier2, ...tier3, ...tier4]) {
      if (!seen.has(item)) {
        seen.add(item);
        ranked.push(item);
      }
    }

    let firstValidIdx = 0;
    while (firstValidIdx < ranked.length && invalidTokens.has(ranked[firstValidIdx])) {
      firstValidIdx++;
    }
    if (firstValidIdx >= ranked.length) firstValidIdx = 0; // fallback

    setState({ items: ranked, activeIdx: firstValidIdx });
  }, [lastWord, allTokens, isActive, numericOnly, invalidTokens]);

  const setActiveIdx = (i: number) =>
    setState((prev) => ({ ...prev, activeIdx: i }));

  return { state, setState, setActiveIdx, isVisible, lastWord, allTokens };
}
