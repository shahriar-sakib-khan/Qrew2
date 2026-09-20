// ─── Formula Bar Types & Constants ───────────────────────────────────────────

export const BINARY_OPS = ["+", "-", "*", "/", "%", "//"] as const;
export const ALL_OPS = ["+", "-", "*", "/", "%", "//", "(", ")"] as const;

export const OPERATORS = [
  { label: "+", title: "Add" },
  { label: "-", title: "Subtract" },
  { label: "*", title: "Multiply" },
  { label: "/", title: "Divide" },
  { label: "(", title: "Open Parenthesis" },
  { label: ")", title: "Close Parenthesis" },
  { label: "%", title: "Percentage (e.g. 50%)" },
  { label: "//", title: "Modulo / remainder" },
] as const;
