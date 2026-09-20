# Formula Bar & Token Architecture Specifications

This document defines the technical rules, keystroke contracts, and state invariants governing the invoice template builder's Formula Bar and Token System in `@starter/web`.

---

## 1. Keystroke & Input Gating (`use-formula-keydown.ts`)

### Allowed Character Whitelist
Only the following inputs are permitted into formula mode:
- **Digits & Decimal**: `0-9`, `.`
- **Operators & Delimiters**: `+`, `-`, `*`, `/`, `%`, `(`, `)`
- **Alphabetic Characters**: Letters matching active token prefixes in `UPPER_SNAKE_CASE`.

### Auto-Capitalization & Exact Token Matching
- All alphabetical input is automatically converted to uppercase (`UPPER_SNAKE_CASE`).
- **No Auto-Underscore**: Automatic insertion of `_` when typing letters is strictly disabled. The user must explicitly type `_` or press `<Space>` (which converts to `_` if matching a token).
- **Exact Prefix Continuation**: Typing a letter is allowed ONLY if the resulting segment (`currentLastWord + letter`) forms an exact prefix or valid continuation of an active token in the template. If no match exists, the keystroke is rejected.

### Strict Binary Operator Spacing
- **Rule**: Spaces exist strictly on both sides of binary operators (` + `, ` - `, ` * `, ` / `, ` // `).
- **Enforcement**:
  - When typing any binary operator (`+`, `-`, `*`, `/`), the input is automatically normalized to `before.trimEnd() + " " + op + " " + after.trimStart()`.
  - Typing an operator on an empty formula or directly following an open parenthesis `(` is blocked with an error toast.
  - Typing consecutive operators (e.g. `+ *`) is silently rejected.
  - Double-slash modulo: typing `/` after an existing `" / "` immediately converts it to `" // "` with single spaces preserved.
- **Smart Atomic Backspace**:
  - Pressing `<Backspace>` when the cursor is directly after a spaced operator (e.g. `" + "`) atomically deletes the entire operator block in one stroke.
  - Pressing `<Backspace>` after `") "` removes both the parenthesis and the space atomically.
  - Manual deletion of spaces with `<Delete>` is blocked.

### Parenthesis Balance Guards
- Typing `)` is rejected if the number of closing parentheses would exceed the number of currently open parentheses.
- Typing `(` directly following a complete token or number without an operator is blocked.

### Keyboard Shortcuts
- **Undo**: `Ctrl+Z` (or `Cmd+Z` on macOS).
- **Redo**: `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on macOS).
- **Ctrl+Y**: Explicitly blocked to enforce `Ctrl+Shift+Z` across all platforms.
- **Save**: `Enter` saves the current formula.
- **Cancel**: `Escape` cancels editing and deselects the active cell.

---

## 2. Autocomplete Engine (`use-formula-autocomplete.ts`)

### Triggering Conditions
Autocomplete triggers automatically whenever the cursor is at a valid token insertion point:
1. At the very start of an expression (empty or leading whitespace).
2. Immediately following an operator: ` + `, ` - `, ` * `, ` / `, ` // `, or `(`.
3. While actively typing a token prefix (`lastWord.length > 0` and not a numeric literal).

### Exact Matching & Uniform Highlighting
- **No Fuzzy Underscore Stripping**: Search queries never strip underscores. Typing `PORTDUES` will NOT match `PORT_DUES`. The user must type `PORT_` to match.
- **Matching Tiers**:
  - Tier 1: Exact prefix match (`token.startsWith(query)`).
  - Tier 2: Word boundary match (`token.split("_").some(part => part.startsWith(query))`).
  - Tier 3: Substring match (`token.includes(query)`).
- **Highlighting (`renderHighlightedToken`)**: Matched characters (including underscores) are highlighted uniformly with an underline, without skipping or isolating underscores.

---

## 3. Universal Circular & Scope Disabling (`formula-evaluator.ts`, `builder-context.tsx`)

Circular and out-of-scope tokens are computed via full DAG reachability and disabled simultaneously across **all three UI surfaces**:

### Multi-Seed Reachability & Cycle Detection
- **Multi-Seed Starting Set**: When evaluating a cell, reachability seeds encompass all identities of that entity (e.g. `rowToken`, `_BASE`, `_CHARGES`, `_TOTAL`, and all row charge items) as well as the containing section tokens it feeds (`SEC_BASE`, `SEC_CHARGES`, `SEC_TOTAL`).
- **Kahn's Algorithm**: The frontend builds the complete template graph and runs Kahn's topological sort in real time. Any cycle nodes with remaining in-degree are flagged as circular.
- **Backend Error Parsing**: Any `validationErrors` from the API (such as cycle toasts) are parsed to ensure server-detected cycle tokens are immediately injected into the invalid set.
- **Row & Section Group Expansion**: If ANY component of a row or section is a downstream dependent or in a cycle, **all tokens belonging to that row or section** (`rowToken`, `_BASE`, `_CHARGES`, `_TOTAL`, and charges) are invalidated.

### Surface 1: Autocomplete Dropdown
- Dependent tokens are styled with `opacity-50 cursor-not-allowed bg-muted/10` and strikethrough.
- Rendered with an `AlertTriangle` icon and specific notice (e.g. `Creates circular dependency: 'PORT_DUES' depends on 'Light Charges'`).
- Hovering explains the specific reason via HTML `title` tooltip.
- Arrow keys skip invalid tokens; clicking or pressing Enter/Tab is blocked.
- Suppresses native browser scrollbars (`no-scrollbar`), ensuring a border-to-border list without visible scrollers.


### Surface 2: Token Pool Sidebar (`token-pool/index.tsx`, `sections-tree.tsx`)
- All circular or hidden tokens render with `opacity-35 cursor-not-allowed`, strikethrough, and an `AlertTriangle` warning icon.
- Hovering over disabled tokens displays a tooltip explaining why (e.g. `Disabled: 'PORT_DUES' creates a circular dependency with Light Charges`).
- Clicking any disabled token blocks insertion and triggers an error toast with the exact reason.

### Surface 3: Table Left-Side Token Banners (`table-row.tsx`, `charge-item.tsx`)
- Row and charge token banners on the left edge of the table render with `opacity-35 cursor-not-allowed` and an `AlertTriangle` icon when in formula mode.
- Hovering explains why the token is disabled.
- Clicking blocks insertion and displays an error toast with the exact reason.

### Scope Exclusion Rules
- **Self & Total Exclusion**: A formula cannot reference its own token, its `_TOTAL` variant, its `_BASE` variant, or its `_CHARGES` variant.
- **Row Base Exclusion**: A row base formula cannot reference any of its own row's charge line items.
- **Section Scope Exclusion**: Rows and row charges inside Section X CANNOT reference `SEC_X`, `SEC_X_BASE`, `SEC_X_CHARGES`, `SEC_X_TOTAL`, or any section charges belonging to Section X.

---

## 4. Syntax Overlay & Spectral Parentheses (`formula-bar-syntax.tsx`)

Parentheses pairs are styled dynamically according to nesting depth:
- **Depth 0 (Level 1)**: Blue (`#3b82f6` / `text-blue-500 font-bold`)
- **Depth 1 (Level 2)**: Red (`#ef4444` / `text-red-500 font-bold`)
- **Depth $\ge$ 2**: Distributed evenly across the visible color wavelength spectrum using dynamic HSL calculation:
  $$\text{hue} = (140 + (\text{depth} - 2) \times 65) \pmod{360}$$
  Progressing smoothly through Emerald/Green $\to$ Amber/Yellow $\to$ Purple $\to$ Cyan $\to$ Pink.
- **Performance**: Calculated via $O(1)$ scalar arithmetic with zero rendering latency.

---

## 5. Paste Sanitization & Validation (`formula-bar/index.tsx`)

Native browser paste is fully intercepted (`e.preventDefault()`) to prevent formula corruption:
1. **Flat Value Cells**: Rejects any non-numeric text.
2. **Formula Cells**:
   - Strips leading `=` if pasted from external spreadsheets.
   - Rejects illegal characters (only numbers, operators, parens, letters, spaces allowed).
   - Validates all tokens inside pasted text against `hiddenTokens`, `invalidTokens`, circular self-references, and active template token pools.
   - Normalizes all binary operators (`+`, `-`, `*`, `/`, `//`) to have strict single spaces around them.
   - Preserves percentage attachments to numbers (e.g. `50%` remains intact).
   - Validates boundary adjacency (prevents two adjacent tokens without operators).
   - Validates parenthesis balance across the resulting string.

---

## 6. Token Pool Presentation & Expansion Rules (`sections-tree.tsx`, `token-pool/index.tsx`)

- **Default Row Dropdown State Rule**: In the Token Pool sidebar, row token dropdowns are **collapsed (closed) by default** unless they contain one or more charge line items (`row.charges && row.charges.length > 0`). Rows with charges start expanded to expose their line charge tokens; rows without charges start closed to keep the sidebar compact.
- **Smooth Background Invariant**: Section containers in the Token Pool share the same smooth, dark background as the overall Token Pool sidebar (`bg-transparent` with subtle `border-border/30`), eliminating contrasting block container backgrounds (`bg-card`).
- **Row Token Info Placement**: The information popover button `(i)` for row tokens is anchored directly beside the `Row Tokens ({count})` label inside the Row Tokens tab pill itself, ensuring users immediately recognize that it documents row tokens.
- **Scrollbar Elimination**: The Token Color Guide dialog suppresses native browser scrollbars (`no-scrollbar`), ensuring neither the top tabs bar nor the dialog body displays clunky native OS scrollbars.

---

## 7. Row Formula Badge Expansion Invariant (`table-row.tsx`)

- **No Popover or "Click to Edit" Badges**: The formula pill beside rows must NEVER render external popovers below or "Click to edit" overlays on hover.
- **In-Place Leftward Expansion**: When hovered, if the formula is truncated because it exceeds the allocated pill width (`max-w-[12rem]`), the badge itself expands **towards the left** (`absolute right-0 top-1`), keeping its right edge pinned beside the row while its left edge expands over the table surface.
- **Downward Multiline Wrapping**: If the formula is too long to fit horizontally across the table surface (`max-w-xl`), it automatically wraps into multiple lines (`whitespace-pre-wrap break-words`). The badge grows downward across the row boundary (`z-50`), cleanly overlaying the row below with a rich elevation shadow (`shadow-2xl`) and backdrop blur (`bg-background/98 backdrop-blur-md`).
- **Non-Truncated Invariance**: If a formula fits completely within the allocated pill space without truncation, it does NOT expand over the table on hover.

