"use client";

import { cn } from "@/lib/utils";

// ─── Parenthesis depth colors ─────────────────────────────────────────────────

const PAREN_COLORS = [
  "text-pink-500",
  "text-blue-500",
  "text-emerald-500",
  "text-amber-500",
  "text-cyan-500",
];

// ─── SyntaxOverlay ────────────────────────────────────────────────────────────

/** Renders formula text with colored parentheses by depth. */
export function SyntaxOverlay({ value }: { value: string }) {
  if (!value) return null;
  const elements: React.ReactNode[] = [];
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") {
      const color = PAREN_COLORS[depth % PAREN_COLORS.length];
      depth++;
      elements.push(<span key={i} className={cn(color, "font-bold")}>{char}</span>);
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      const color = PAREN_COLORS[depth % PAREN_COLORS.length];
      elements.push(<span key={i} className={cn(color, "font-bold")}>{char}</span>);
    } else {
      elements.push(<span key={i} className="text-violet-400">{char}</span>);
    }
  }

  return <>{elements}</>;
}

// ─── Fuzzy Highlight ──────────────────────────────────────────────────────────

/** Renders a token string with matched characters highlighted. */
export function renderHighlightedToken(token: string, search: string): React.ReactNode {
  if (!search) return token;
  const searchClean = search.replace(/_/g, "").toUpperCase();
  if (!searchClean) return token;

  const tokenClean = token.replace(/_/g, "").toUpperCase();
  const startIndex = tokenClean.indexOf(searchClean);
  if (startIndex === -1) return token;

  const elements: React.ReactNode[] = [];
  let cleanIdx = 0;
  let inHighlight = false;
  let currentSegment = "";

  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const isUnderscore = char === "_";

    let isMatch = false;
    if (!isUnderscore) {
      if (cleanIdx >= startIndex && cleanIdx < startIndex + searchClean.length) {
        isMatch = true;
      }
      cleanIdx++;
    }

    if (isMatch !== inHighlight) {
      if (currentSegment) {
        elements.push(
          inHighlight ? (
            <span key={i} className="text-primary font-bold">{currentSegment}</span>
          ) : (
            currentSegment
          )
        );
      }
      currentSegment = char;
      inHighlight = isMatch;
    } else {
      currentSegment += char;
    }
  }

  if (currentSegment) {
    elements.push(
      inHighlight ? (
        <span key="last" className="text-primary font-bold">{currentSegment}</span>
      ) : (
        currentSegment
      )
    );
  }

  return <>{elements}</>;
}
