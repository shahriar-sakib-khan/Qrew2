# THE ROW SYSTEM — COMPLETE FEATURE SPECIFICATION
## For Coding Agent Implementation Reference

---

## 1. What a Row Is

A **row** is the single atomic unit of an invoice template. Every line that appears in a generated invoice PDF originates from a row. Rows live inside sections, sections live inside templates.

Each row does one of three things:
1. **Computes a value** — from a formula, a constant, or staff input
2. **Aggregates other rows** — sums a section and applies a formula to that sum
3. **Displays information** — labels, headers, organizational dividers

A row always produces two numeric outputs:
- `baseValue` — the raw calculated amount before any surcharge
- `totalValue` — the final amount after applying the optional row-level surcharge

These map to the two USD columns in the PDF. This is fundamental. Every row has both. For rows without a surcharge, `totalValue = baseValue`.

---

## 2. The Seven Row Types

### 2.1 `formula`
**What it does:** Evaluates a mathematical expression using injectable tokens.

**Key fields:**
- `formulaRaw` — required. The formula string: `"{{FILE_GRT}} * {{ORG_PORT_RATE}}"`
- `surchargeFormula` — optional. Applied on top of the base: `"BASE * {{ORG_VAT_RATE}} + BASE * {{ORG_AIT_RATE}}"`

**Behavior:**
- At preview/generate time: all `{{TOKEN}}` references are resolved to BigNumber values, then `mathjs.evaluate()` computes the result
- `BASE` in the surcharge formula is a reserved word that means "this row's computed baseValue"
- If the formula references `{{ROW_SOME_TOKEN}}` from another row, that other row must evaluate first (topological sort handles this)

**Example:**
```
formulaRaw:        "{{FILE_GRT}} * 0.306"
surchargeFormula:  "BASE * {{ORG_VAT_RATE}}"
label:             "PORT DUES @ US$ 0.306 PER GRT X {{$FILE_GRT}}"

With FILE_GRT = 20151, ORG_VAT_RATE = 0.15:
  baseValue    = 20151 * 0.306 = 6,166.206
  surcharge    = 6,166.206 * 0.15 = 924.931
  totalValue   = 7,091.137
```

---

### 2.2 `constant`
**What it does:** Holds a fixed numeric value set by the admin. Pre-filled on every invoice.

**Key fields:**
- `constantValue` — required. The numeric(20,6) value: `1230.000000`
- `isDefaultOverrideable` — if true, staff can override this value in the invoice generator
- `surchargeFormula` — optional. Works the same as formula rows.

**Behavior:**
- `baseValue = constantValue` always
- If staff has overridden it in their draft: `baseValue = overriddenValue`
- Admin sets this; staff sees it pre-filled and can optionally change it

**Example:**
```
label:          "PILOT - 1 UNIT MANDATORY PAY"
constantValue:  1230.000000
→ baseValue = 1230.00
→ totalValue = 1230.00 (no surcharge configured)
```

---

### 2.3 `manual`
**What it does:** An intentionally empty row. Staff must input the value per invoice.

**Key fields:**
- `defaultValue` — optional. Pre-fills the input but staff can change it
- `placeholder` — optional. Hint text shown in the empty input field
- `surchargeFormula` — optional

**Behavior:**
- In the invoice generator, this row shows an input field
- If `defaultValue` is set, the input starts pre-filled (still editable)
- If no value is entered by staff and no default: `baseValue = 0`
- This row type is for costs that vary per file and cannot be calculated from tokens

**Example:**
```
label:        "MISC TO HEALTH QUARANTINE"
defaultValue: null
placeholder:  "Enter amount..."
→ Staff types 450.00 → baseValue = 450.00
```

---

### 2.4 `section_aggregate`
**What it does:** Sums all non-aggregate rows in a target section and applies a formula to that sum. This is how VAT, AIT, commissions, and other section-level calculations are handled.

**Key fields:**
- `aggregateTargetSectionId` — required. The section whose rows this aggregates
- `formulaRaw` — the formula applied to `SECTION_SUM`: `"SECTION_SUM * {{ORG_VAT_RATE}}"`

**What `SECTION_SUM` is:**
`SECTION_SUM` is a special reserved token available only in section_aggregate formulas. It equals the sum of `totalValue` of all non-section_aggregate rows within the target section at the time of evaluation.

**The two-column behavior for this row type:**
- `baseValue` = `SECTION_SUM` (the sum before the aggregate formula)
- `surchargeValue` = result of evaluating `formulaRaw` with `SECTION_SUM` resolved
- `totalValue` = `baseValue + surchargeValue`

**Critical behavior:** The aggregate row can be positioned ANYWHERE in the sort order — it does not need to sit at the bottom of its section. The `aggregateTargetSectionId` controls what gets summed, not position. This allows "pre-declared" aggregate rows that appear at the top of a section (as in some maritime PDA formats) while still computing the sum of all rows below.

**Critical behavior:** The aggregate row can target a DIFFERENT section than it belongs to. A row can live in Section A but aggregate Section B. This is intentional.

**Adding or removing rows from the target section automatically recalculates** `SECTION_SUM` at runtime. The admin never needs to update the aggregate formula when rows change.

**Example:**
```
section: "Port Mandatory Costs"
  row: PORT_DUES     totalValue = 6,166.21
  row: PILOT         totalValue = 1,230.00
  row: TUG_HIRE      totalValue =   800.00
  row: PORT_VAT      (section_aggregate targeting this section)
    formulaRaw: "SECTION_SUM * {{ORG_VAT_RATE}}"

At evaluation:
  SECTION_SUM = 6166.21 + 1230.00 + 800.00 = 8,196.21
  surchargeValue = 8196.21 * 0.15 = 1,229.43
  baseValue = 8,196.21
  totalValue = 9,425.64
```

---

### 2.5 `multi_value`
**What it does:** A single logical row that contains multiple sub-calculation components. All components combine to produce the row's base value. This is for cases where one "line item" in the invoice is actually the result of multiple calculations or sub-costs that share a single SL number.

**Key fields:**
- `subComponents` — required JSONB array of `SubComponentV1` objects
- `formulaRaw` — optional formula applied to `COMPONENT_SUM`
  - If absent: `baseValue = COMPONENT_SUM` directly
  - If present: e.g., `"COMPONENT_SUM / {{ORG_EXCHANGE_RATE}}"` — the sum of components is fed into this formula
- `surchargeFormula` — optional, applied to the result of `formulaRaw` (or `COMPONENT_SUM` if no `formulaRaw`)

**SubComponentV1 shape:**
```typescript
{
  id: string              // stable uuid, do NOT change on edits
  label: string           // display label: "Arrival Tugboat Hire"
  formulaRaw?: string     // if this component itself is a formula
  constantValue?: string  // BigNumber string if constant
  isManual: boolean       // true → staff enters this value per invoice
  manualValue?: string    // the value staff entered (stored in draft/line item)
  sortOrder: number
}
```

**`COMPONENT_SUM` — the reserved token:**
Within a `multi_value` row's `formulaRaw`, `COMPONENT_SUM` is a special token that equals the sum of all component values (resolved constants, evaluated formulas, and staff manual entries).

**Evaluation steps:**
1. Evaluate each component (formula components run through AST evaluator, constants are their value, manual components use the staff-entered value or 0)
2. Sum all component values → `COMPONENT_SUM`
3. If `formulaRaw` exists: evaluate it with `COMPONENT_SUM` resolved → `baseValue`
4. If no `formulaRaw`: `baseValue = COMPONENT_SUM`
5. If `surchargeFormula`: evaluate it with `BASE = baseValue` → `surchargeValue`
6. `totalValue = baseValue + surchargeValue`

**PDF rendering:** All components render as indented detail lines within the same SL# row. They do NOT get their own SL numbers. This is the key reason this row type exists — preserving the formal SL# structure of professional invoices.

**Example:**
```
subComponents:
  [0] "Arrival Tugboat Hire"  constant: 800.00
  [1] "Sailing Tugboat Hire"  constant: 800.00

formulaRaw: null  (no additional formula — base is just the component sum)
surchargeFormula: "BASE * 0.20"  (15% VAT + 5% AIT)

COMPONENT_SUM = 800 + 800 = 1,600.00
baseValue = 1,600.00
surcharge = 1,600 * 0.20 = 320.00
totalValue = 1,920.00

PDF renders as:
  SL 04  TUGBOAT HIRE CHARGES
           Arrival Tugboat Hire                   800.00
           Sailing Tugboat Hire                   800.00
         MANDATORY 15%VAT + 5% AIT               1,600.00   1,920.00
```

---

### 2.6 `header_label`
**What it does:** A non-calculating row used purely for visual organization within the invoice. Produces no numeric values.

**Key fields:**
- `label` — the text to display
- No formula, no value fields

**Behavior:**
- `baseValue = 0`, `totalValue = 0`
- `isVisible` defaults to true but can be false
- Does NOT participate in any `SECTION_SUM` calculation
- Used for things like section title rows that appear in the PDF as bold dividers

---

### 2.7 `grand_total`
**What it does:** Computes the final invoice total. Sums all section totals (or specific row values).

**Key fields:**
- `formulaRaw` — typically references multiple `SECTION_*_SUM` tokens or uses a special `ALL_SECTIONS_TOTAL` reserved token

**Special token `ALL_SECTIONS_TOTAL`:**
A reserved token available only in `grand_total` rows. Equals the sum of `totalValue` of all rows across all sections in the template (excluding other `grand_total` rows).

**Behavior:**
- One `grand_total` row per template (enforced by the DAG validator — two grand_total rows targeting the same scope creates ambiguity)
- Typically `isVisible = true` and positioned as the last row
- Has no surcharge (surcharge on a grand total is meaningless)

---

## 3. The Complete Row Field Model

Every row in `template_rows` has the following fields. This is the single source of truth for what data a row stores.

```
IDENTITY
  id              — uuid PK
  templateId      — FK to invoice_templates (always required)
  sectionId       — FK to template_sections (nullable — unsectioned for grand_total)
  rowToken        — UPPER_SNAKE_CASE string, unique per template
                    This is the row's name in the formula namespace: ROW_{rowToken}
                    e.g., "PORT_DUES" → referenced in other formulas as {{ROW_PORT_DUES}}
  rowType         — one of the 7 types above

DISPLAY TEXT (all support {{$TOKEN}} interpolation at render time)
  label           — main line item name: "PORT DUES @ US$ 0.306 PER GRT X {{$FILE_GRT}}"
  subDescription  — calculation explanation: "PER GRT X 0.306 × {{$FILE_GRT}} (1 MONTH)"
  surchargeLabel  — right-aligned inline tax label: "MANDATORY 15%VAT + 10% AIT"
                    Only shown when surchargeFormula is present
  qualifier       — selected from admin-configured dropdown: "AS PER PORT TARIFF"
                    Shown as the last text segment in the details column

FORMULA FIELDS
  formulaRaw      — the base calculation formula string (supports {{TOKEN}})
  formulaAst      — pre-parsed mathjs AST (jsonb, cached on save for performance)
  surchargeFormula — optional surcharge formula, BASE token = this row's baseValue

VALUE FIELDS
  constantValue   — numeric(20,6) — for rowType 'constant' only
  defaultValue    — numeric(20,6) — for rowType 'manual', optional pre-fill
  isDefaultOverrideable — bool, default true

SPECIAL TYPE FIELDS
  subComponents          — jsonb (SubComponentV1[]) — for rowType 'multi_value'
  aggregateTargetSectionId — FK to template_sections — for rowType 'section_aggregate'

DISPLAY SETTINGS
  computationCurrency    — 'USD' default
  isVisible              — bool, default true
                           false = row computes but never appears in PDF
                           still participates in SECTION_SUM calculations
  sortOrder              — integer, determines render order within section

AUDIT
  createdAt, updatedAt
```

---

## 4. The Two-Column Value System

This is the visual and computational backbone of the invoice format.

### The Four Possible Output States Per Row

**State A — No surcharge, visible row:**
```
Left column (base):   empty
Right column (total): 6,166.21
```
Used for: plain formula/constant/manual rows with no tax.

**State B — Has surcharge, visible row:**
```
Left column (base):   6,166.21   ← pre-tax amount
Right column (total): 7,091.14   ← post-tax amount (base + surcharge)
```
The `surchargeLabel` ("MANDATORY 15%VAT") appears right-aligned in the details column above the values.

**State C — Section aggregate row:**
```
Left column (base):   8,196.21   ← SECTION_SUM (sum of the section)
Right column (total): 9,425.64   ← SECTION_SUM + aggregate formula result
```

**State D — invisible row (isVisible = false):**
Neither column shown in PDF. Row computed and added to scope for other rows to reference.

### How the Grand Total Is Computed
The grand total sums ALL values in the **right column** (totalValue) across all rows. Not the left column. This is the legally binding amount.

### The `showSubtotalColumn` PDF Layout Setting
When `invoice_pdf_layouts.showSubtotalColumn = false`, the left column is hidden entirely in the PDF. All rows show only the right column. This produces the single-column invoice format. When `true`, the left column is shown for rows where `baseValue ≠ totalValue`.

---

## 5. Token Interpolation in Text Fields

This is completely separate from formula evaluation. It applies to: `label`, `subDescription`, and `surchargeLabel` fields only. NOT to `formulaRaw` or `surchargeFormula`.

### Two Syntaxes

**`{{TOKEN_NAME}}`** — renders the token KEY as literal text.

```
Template: "PORT DUES @ US$ 0.306 PER {{FILE_GRT}}"
Renders as: "PORT DUES @ US$ 0.306 PER FILE_GRT"
```

This is used when you want to reference the token name itself in the description text (uncommon).

**`{{$TOKEN_NAME}}`** — renders the RESOLVED VALUE of the token.

```
Template: "PORT DUES @ US$ 0.306 PER GRT X {{$FILE_GRT}}"
With FILE_GRT = 46668:
Renders as: "PORT DUES @ US$ 0.306 PER GRT X 46668"
```

This is the common and useful one. When staff open an invoice for a vessel with GRT 46668, the label automatically shows the actual number. When they open an invoice for a vessel with GRT 20151, it shows 20151. The template never needs to be edited.

### Formatting Rules for `{{$TOKEN}}`
- `number` type ORG configs: renders as the raw number (`"121.20"`)
- `percentage` type ORG configs: renders as percentage (`"0.15"` → `"15%"`)
- `currency_rate` type ORG configs: renders with 2 decimal places
- `FILE_*` values: renders as-is from the source field

### When Interpolation Runs
Text interpolation runs at PDF generation time, after formula evaluation. It uses the same `resolvedScope` that the formula engine used. This means:
- At preview time: labels show interpolated values (so you can see "PER GRT X 46668" in the preview)
- In frozen invoice_line_items: the `label` and `subDescription` columns store the INTERPOLATED values (the resolved text, not the template string)
- In `historicalFormat` JSONB: the `label` field stores the ORIGINAL template string (with `{{$TOKEN}}` syntax intact) for audit purposes

---

## 6. The Qualifier Field (The Dropdown Label)

The `qualifier` field is a standardized reference label shown at the end of the details column. It is selected from a list configured by the organization admin (not a free-text field in the template — though staff can override it in the generator).

**Purpose:** In formal billing documents, every line item often has a standardized reference like "AS PER PORT TARIFF," "AS PER CONTRACT," "AS PER GOVERNMENT NOTIFICATION." These are not descriptions of the calculation — they are citations of the authority or basis for the charge.

**Where the options come from:** The organization admin configures the list of qualifier options in the org settings. Think of it like a dropdown where the options are: "AS PER PORT TARIFF" | "AS PER TARIFF" | "AS PER GOVERNMENT GAZETTE" | "AS PER CONTRACT" | "AS PER QUOTATION" | (custom entry). The admin manages this list, staff picks from it.

**How it renders in the details column:**
- Depending on `detailColumnSeparator` in the PDF layout:
  - `'newline'`: qualifier appears on its own line below the label and sub-description
  - `'pipe'`: `"PORT DUES | PER GRT X 0.306 | AS PER PORT TARIFF"`
  - `'hyphen'`: `"PORT DUES - PER GRT X 0.306 - AS PER PORT TARIFF"`
  - `'none'`: label + sub-description + qualifier are just concatenated with a space

---

## 7. The Row Token Identity System

The `rowToken` is the row's identifier within the formula namespace. It is UPPER_SNAKE_CASE, unique per template, and set at creation time.

### Rules
- Format: `^[A-Z][A-Z0-9_]*$` — must start with a letter, only uppercase letters, digits, and underscores
- Maximum 50 characters
- Unique within the template (enforced at DB level with UNIQUE constraint on `(templateId, rowToken)`)
- **IMMUTABLE once another row in the same template references it in a formula.** If `PORT_DUES` is referenced as `{{ROW_PORT_DUES}}` in a later row, you cannot change the token from `PORT_DUES` to `PORT_DUES_V2` without breaking that reference.
- The UI must enforce this: if the token is referenced anywhere, the `rowToken` field becomes read-only in the edit form. Show a small badge: `"Used in 2 formulas"`

### How the Token Is Used
- In other rows' `formulaRaw`: `"{{ROW_PORT_DUES}} * 0.05"` — references the `totalValue` of the PORT_DUES row
- In `subDescription` or `label`: `"5% of {{$ROW_PORT_DUES}}"` — shows the resolved value

### Auto-Suggestion
When an admin types a label ("Port Dues"), the UI auto-suggests a token ("PORT_DUES"). The admin can override this before saving. Once saved and referenced, it locks.

---

## 8. The Section Relationship

Every row (except `grand_total`) belongs to a section via `sectionId`. Sections provide:
1. Visual grouping in the template builder and PDF
2. The `SECTION_{sectionToken}_SUM` token (sum of non-aggregate rows in the section)
3. The target for `section_aggregate` rows

### The `SECTION_{sectionToken}_SUM` Token
When a section named "Port Mandatory Costs" has `sectionToken = 'PORT_COSTS'`, the token `{{SECTION_PORT_COSTS_SUM}}` becomes available in any formula in the template. It equals the sum of `totalValue` of all non-`section_aggregate` rows in that section.

This token updates progressively during evaluation — it reflects the running sum as rows are evaluated in topological order.

### Which Rows Count Toward SECTION_SUM
- `formula` rows: YES, `totalValue` counted
- `constant` rows: YES
- `manual` rows: YES (even if value is 0)
- `multi_value` rows: YES, `totalValue` counted (not individual components)
- `header_label` rows: NO (zero value, decorative only)
- `section_aggregate` rows: NO (would create circular logic)
- `grand_total` rows: NO

---

## 9. Row Evaluation Lifecycle

Understanding this is critical for implementing the math engine and for the UI to show the right states.

### Step 1: DAG Construction (run at SAVE TIME)
When any row's `formulaRaw` or `surchargeFormula` is saved:
1. Parse all `{{TOKEN}}` references using regex `/\{\{([A-Z_$][A-Z0-9_]*)\}\}/g`
2. For each `ROW_X` reference: draw a dependency edge (this row depends on ROW_X's row)
3. For each `SECTION_X_SUM` reference: draw dependency edges on ALL rows in that section
4. `CAT_*`, `ORG_*`, `FILE_*` tokens: no edges (they're external inputs)
5. `BASE` and `COMPONENT_SUM` and `SECTION_SUM`: no edges (built-in reserved tokens)
6. Run Kahn's algorithm to detect cycles
7. If cycle: REJECT the save with 409 — show exactly which rows form the cycle
8. If valid: cache the topological order (not stored, recomputed at preview/generate)

### Step 2: Token Resolution (run at PREVIEW/GENERATE TIME)
Build the initial scope `Record<tokenKey, BigNumber>`:
- `CAT_*`: `SELECT ec.tokenKey, COALESCE(SUM(e.amount), 0) FROM expense_categories ec LEFT JOIN expenses e ON e.categoryId = ec.id AND e.projectId = ? GROUP BY ec.tokenKey`
- `ORG_*`: `SELECT configKey, configValue FROM organization_configs WHERE orgId = ? AND isFormulaInjectable = true`
- `FILE_*`: read from `projects.customFields` and direct columns per `template_header_fields` config

### Step 3: Sequential AST Evaluation (run at PREVIEW/GENERATE TIME)
For each row in topological order:
1. Resolve all `{{TOKEN}}` in `formulaRaw` from the current scope
2. Evaluate `formulaRaw` with mathjs BigNumber → `baseValue`
3. If `surchargeFormula`: replace `BASE` with `baseValue`, evaluate → `surchargeValue`
4. `totalValue = baseValue + surchargeValue`
5. Add to scope: `ROW_{rowToken} = totalValue`
6. Update running section sum: `sectionSums[sectionId] += totalValue`
7. Update scope: `SECTION_{sectionToken}_SUM = current sectionSums[sectionId]`

### Step 4: Text Interpolation (run at PREVIEW/GENERATE TIME, after step 3)
For each row:
1. Run text interpolator on `label`, `subDescription`, `surchargeLabel`
2. Replace `{{$TOKEN}}` with formatted resolved values from scope
3. Replace `{{TOKEN}}` with literal token key text

---

## 10. UI/UX — Template Builder

### 10.1 The Row in Its Section (Compact View)

Each row in the section list renders as a compact card (not expanded). The card shows everything the admin needs to scan without opening the row:

```
┌────────────────────────────────────────────────────────────┐
│ [⠿]  [formula]  PORT DUES @ US$ 0.306 PER GRT X {{$FILE..  [✎] [✕] │
│       {{FILE_GRT}} * {{ORG_PORT_RATE}}                                │
│       Surcharge: BASE * {{ORG_VAT_RATE}}  ·  Token: PORT_DUES        │
└────────────────────────────────────────────────────────────┘
```

Elements in order:
- `[⠿]` — drag handle (pointer cursor, only this triggers drag)
- `[rowType badge]` — color-coded pill: formula=blue, constant=gray, manual=yellow, section_aggregate=purple, multi_value=orange, header_label=neutral, grand_total=green
- `label` — truncated to single line (max 60 chars + ellipsis)
- `[✎]` — Edit button, expands the row inline
- `[✕]` — Delete button, shows confirmation dialog

Second line (dimmed text):
- For formula/section_aggregate rows: the first 50 chars of `formulaRaw`
- For constant rows: "Fixed: [value]"
- For manual rows: "Staff input" (or "Default: [value]" if defaultValue set)
- For multi_value rows: "[n] components"

Third line (dimmed text):
- Surcharge info if surchargeFormula is set
- `· Token: [rowToken]`

If the row has a validation error (DAG cycle, unknown token): red left border + error badge.

### 10.2 Adding a Row — The Two-Step Flow

**Step 1: Row Type Selector**
Clicking `[+ Add Row]` opens a bottom sheet (on mobile) or inline panel (on desktop):

```
What kind of row do you need?

┌─────────────────────────────────────────────────────┐
│ ○ Formula           Calculate using tokens & math   │
│   {{FILE_GRT}} * {{ORG_PORT_RATE}}                  │
│                                                      │
│ ○ Constant          Fixed amount, same every invoice │
│   Pre-filled: 1,230.00                              │
│                                                      │
│ ○ Manual Input      Staff enters this per invoice    │
│   [ empty input field ]                             │
│                                                      │
│ ○ Multi-Value       Multiple components, one SL#    │
│   (800 + 800) / {{ORG_EXCHANGE_RATE}}               │
│                                                      │
│ ○ Section Aggregate Apply formula to section total   │
│   SECTION_SUM * {{ORG_VAT_RATE}}                    │
│                                                      │
│ ○ Label / Divider   Visual header, no calculation    │
│   ──── Section Title ────                           │
└─────────────────────────────────────────────────────┘

[Cancel]  [Continue →]
```

**Step 2: Inline Row Editor**
Opens directly below the `[+ Add Row]` button inline in the section (does not navigate away, does not open a modal). The full template stays visible behind it.

### 10.3 The Expanded Row Editor — All Fields

The inline editor has a consistent layout regardless of row type. Fields that don't apply to the selected type are hidden:

```
┌──────────────────────────────────────────────────────────────────┐
│  Row Type: [formula ▼]               Row Token: [PORT_DUES     ] │
│                                                 ⚠ Used in 2 formulas │
│  ─── DISPLAY TEXT ───────────────────────────────────────────── │
│  Label:                                                           │
│  [PORT DUES @ US$ 0.306 PER GRT X {{$FILE_GRT}}               ] │
│  [🪙 Insert token ▼]  (this button is in TEXT mode)             │
│                                                                   │
│  Sub-Description (optional):                                      │
│  [PER GRT X 0.306 × {{$FILE_GRT}} (FOR ONE CALENDAR MONTH)    ] │
│  [🪙 Insert token ▼]                                             │
│                                                                   │
│  Qualifier (optional):  [AS PER PORT TARIFF          ▼]          │
│                                                                   │
│  ─── BASE CALCULATION ──────────────────────────────────────── │
│  Formula:                                                         │
│  [{{FILE_GRT}} * {{ORG_PORT_RATE}}                             ] │
│  [🪙 Insert token ▼]  (this button is in FORMULA mode)          │
│  [✓ Valid — evaluates to ~6,166.21]  ← live validation badge    │
│                                                                   │
│  ─── ROW-LEVEL SURCHARGE (optional) ───────────────────────── │
│  [☐ Enable inline surcharge on this row]                         │
│                                                                   │
│  ↳ (when enabled):                                               │
│  Surcharge Label:                                                 │
│  [MANDATORY 15%VAT + 10% AIT                                   ] │
│                                                                   │
│  Surcharge Formula (BASE = this row's calculated amount):        │
│  [BASE * {{ORG_VAT_RATE}} + BASE * {{ORG_AIT_RATE}}           ] │
│  [🪙 Insert token ▼]                                             │
│  [✓ Valid — surcharge ~1,233.24]                                 │
│                                                                   │
│  ─── VISIBILITY ────────────────────────────────────────────── │
│  [✓ Show this row in the invoice PDF]                            │
│                                                                   │
│                              [Cancel]  [Save Row]                │
└──────────────────────────────────────────────────────────────────┘
```

**Token Injector Button Behavior — Two Modes:**

When the `[🪙 Insert token ▼]` button is next to a DISPLAY TEXT field (label, subDescription, surchargeLabel):
- The dropdown inserts `{{$TOKEN_NAME}}` — for showing resolved values in text
- Example: clicking "GRT (FILE_GRT)" inserts `{{$FILE_GRT}}`
- The dropdown label reads: "Insert value into text"

When the `[🪙 Insert token ▼]` button is next to a FORMULA field (formulaRaw, surchargeFormula):
- The dropdown inserts `{{TOKEN_NAME}}` — for use in math
- Example: clicking "GRT (FILE_GRT)" inserts `{{FILE_GRT}}`
- The dropdown label reads: "Insert formula token"

This is not optional. The two modes must be visually distinct. One inserts `{{$TOKEN}}`, the other inserts `{{TOKEN}}`. A user must never need to remember this syntax difference — the button handles it.

### 10.4 Section Aggregate Row — Specific Editor

When row type is `section_aggregate`, the editor changes:

```
│  Row Type: [section_aggregate]       Row Token: [PORT_VAT       ] │
│                                                                    │
│  Label: [VAT 15% ON PORT COSTS                                  ] │
│                                                                    │
│  Aggregate Target Section:                                         │
│  [Port Mandatory Costs ▼]  ← dropdown of all sections in template │
│  "SECTION_SUM will equal the total of all non-aggregate rows       │
│   in the selected section at the time this row is evaluated."     │
│                                                                    │
│  Formula (applied to SECTION_SUM):                                 │
│  [SECTION_SUM * {{ORG_VAT_RATE}}                                ] │
│  [🪙 Insert token ▼]                                              │
│  [✓ Valid — evaluates to ~1,229.43 with test data]               │
│                                                                    │
│  Note: This row can be placed anywhere in the template.            │
│  It will always compute from the live sum of its target section.  │
```

The aggregate row is not forced to be the last row in a section. The admin can drag it to any position. The preview panel always shows the correct computed value regardless of position.

### 10.5 Multi-Value Row — Specific Editor

```
│  Row Type: [multi_value]             Row Token: [TUG_HIRE        ] │
│  Label: [TUGBOAT HIRE CHARGES                                    ] │
│  Sub-Description: [Arrival & Sailing formalities at STS Anchorage] │
│                                                                    │
│  ─── COMPONENTS ──────────────────────────────────────────────── │
│  [⠿] [Arrival Tugboat Hire] [constant ▼] [800.00     ] [✕]       │
│  [⠿] [Sailing Tugboat Hire] [constant ▼] [800.00     ] [✕]       │
│  [+ Add Component]                                                 │
│                                                                    │
│  COMPONENT_SUM = 1,600.00  (live, updates as components change)   │
│                                                                    │
│  ─── FORMULA ON COMPONENT_SUM (optional) ─────────────────────── │
│  [☐ Apply formula to component sum]                                │
│  (if enabled): [COMPONENT_SUM / {{ORG_EXCHANGE_RATE}}           ] │
│  "Leave blank if the sum of components IS the row value"          │
│                                                                    │
│  ─── ROW-LEVEL SURCHARGE ─────────────────────────────────────── │
│  [☐ Enable inline surcharge on this row]                          │
│  Surcharge Label: [MANDATORY 15%VAT + 5% AIT                    ] │
│  Surcharge Formula: [BASE * 0.20                                 ] │
```

Component types (per component, individual dropdown):
- `constant` — admin enters a fixed number
- `manual` — staff enters per invoice (shows input in generator)
- `formula` — admin enters a formula with token support

When a component is `formula` type, the component row expands:
```
[⠿] [Port Dues (1 month)] [formula ▼] [{{FILE_GRT}} * 0.306     ] [✕]
```

### 10.6 Drag-and-Drop Row Reordering

**Within a section:** Drag by the `[⠿]` handle only. Drop anywhere within the section. The section header and the `[+ Add Row]` button are drop targets for top and bottom positions.

**Between sections:** Dragging a row to a different section changes its `sectionId`. Show a visual "drop zone" at the top and bottom of each section. Show a brief animation when a row's section changes.

**Important UX detail:** Dragging a `section_aggregate` row into a different section does NOT change which section it aggregates — that's controlled by `aggregateTargetSectionId`. Moving the aggregate row between sections only changes its visual position in the template and in the PDF.

**After any drag-drop:** Immediately call `PATCH /api/invoice-templates/:id/rows/reorder` with the new sortOrder and sectionId values. Show a subtle "saving" indicator. Revert to previous state on error.

### 10.7 Validation States Per Row

Each row card shows one of these states:

| State | Visual | When |
|---|---|---|
| Valid | Green check badge | Formula evaluates correctly with test data |
| Warning | Yellow badge | No test project selected, cannot verify |
| Error — Token | Red badge "Unknown token: {{CAT_PILOTAGE}}" | Token not found in any namespace |
| Error — Cycle | Red badge "Circular reference: ROW_X → ROW_Y → ROW_X" | DAG cycle detected |
| Error — Syntax | Red badge "Invalid formula syntax" | mathjs cannot parse |
| Untested | Gray badge | Row is constant/manual — no formula to validate |

The `[Save Row]` button is always enabled. Validation errors are shown as warnings, not blockers. This allows admins to work on complex templates over time, saving partial work. However, the preview panel will show the error clearly, and the generate endpoint will refuse to proceed if any errors exist.

---

## 11. UI/UX — Invoice Generator (Staff View)

In the generator, rows from the selected template (or draft) are rendered for staff interaction. The interaction model per row type is different from the builder.

### 11.1 Formula Row in the Generator

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔒 PORT DUES @ US$ 0.306 PER GRT X 46668        6,166.21  7,091.14 │
│    PER GRT X 0.306 × 46668 (FOR ONE CALENDAR MONTH)              │
│    MANDATORY 15%VAT                                               │
│    [Override Formula ▼]  ← small link, not prominent             │
└─────────────────────────────────────────────────────────────────┘
```

- Values are computed and shown immediately (from the live preview)
- A 🔒 icon indicates this row's value comes from a formula (staff cannot edit the value directly)
- `[Override Formula ▼]` is a low-profile option. When clicked, it expands into a formula input with token injector. If staff changes the formula, a small `[Overridden]` badge appears and the original formula is shown for reference. A `[Reset to Original]` link appears.
- Left value = baseValue, right value = totalValue. For rows without surcharge: only right value shown.

### 11.2 Constant Row in the Generator

```
┌─────────────────────────────────────────────────────────────────┐
│ 📌 PILOT - 1 UNIT MANDATORY PAY                         1,230.00 │
│    [Override: ____________]  ← inline override input            │
└─────────────────────────────────────────────────────────────────┘
```

- 📌 icon indicates a constant (admin-set default)
- Override input is shown inline but unfocused/faint — it's there if needed but not dominant
- If staff types in it: value updates, `[Overridden]` badge appears, `[Reset: 1,230.00]` link appears
- If `isDefaultOverrideable = false`: the override input is hidden entirely. Row is truly fixed.

### 11.3 Manual Row in the Generator

```
┌─────────────────────────────────────────────────────────────────┐
│ ✏ MISC TO HEALTH QUARANTINE    [_____________]  ← required input │
│   Enter amount...                               0.00             │
└─────────────────────────────────────────────────────────────────┘
```

- ✏ icon indicates staff input required
- Input field is prominent and focused
- Real-time update to preview panel on input (debounced 300ms)
- If left empty: value = 0, but the row may show a `[!]` indicator if it was likely expected to have a value (this is a UX hint, not a blocker)

### 11.4 Multi-Value Row in the Generator

```
┌─────────────────────────────────────────────────────────────────┐
│ ⊞ TUGBOAT HIRE CHARGES                                1,600.00  1,920.00 │
│   MANDATORY 15%VAT + 5% AIT                                     │
│   ▼ [Show components]                                            │
│     Arrival Tugboat Hire    [800.00 ]  ← constant, overrideable  │
│     Sailing Tugboat Hire    [800.00 ]  ← constant, overrideable  │
│     [+ Add Component]       ← staff can add ad-hoc components    │
└─────────────────────────────────────────────────────────────────┘
```

- ⊞ icon indicates multi-value
- Components are collapsed by default (show just the total)
- Expanding shows each component with its value/input
- Manual components show input fields
- Constant components show their value with override capability
- `[+ Add Component]` allows staff to add an unlabeled cost to this row (creates an ad-hoc `manual` component with a label input)

### 11.5 Section Aggregate Row in the Generator

```
┌─────────────────────────────────────────────────────────────────┐
│ ∑ VAT 15% ON PORT COSTS                       8,196.21  9,425.64 │
│   ON FOLLOWING ALL PORT COSTS                                    │
│   [Override VAT Rate ▼]  ← small override for the formula rate  │
└─────────────────────────────────────────────────────────────────┘
```

- ∑ icon indicates section aggregate
- Left value = SECTION_SUM, right value = SECTION_SUM + VAT amount
- `[Override VAT Rate ▼]` provides a way to change just the multiplier for this invoice (e.g., the usual 15% but this client has a 0% exemption)
- Does not affect the organization template

### 11.6 Adding an Override Row (Staff Ad-Hoc Row)

Staff can add a completely new row that wasn't in the template:

```
[+ Add Row to This Section]

Clicking opens a minimal dialog:
  Label:    [_______________________]
  Amount:   [_______________________]  ← manual input
  Sub-Desc: [_______________________]  (optional)
  
  [Cancel]  [Add Row]
```

These override rows are `rowType: 'manual'` with an auto-generated `rowToken` like `OVERRIDE_1`, `OVERRIDE_2`. They exist only in the draft and in the frozen invoice. They are not added to the organization template.

---

## 12. Row Rendering in the PDF

### The DETAILS Column Structure

Each row in the PDF's details column renders its text fields based on the `detailColumnSeparator` setting from the PDF layout config:

**`'newline'` (default, most professional):**
```
DETAILS
──────────────────────────────────────────────
PORT DUES
PER GRT X 0.306 × 46668 (FOR ONE CALENDAR MONTH)
                              MANDATORY 15%VAT + 10% AIT   ←right-aligned
```

**`'pipe'`:**
```
DETAILS
──────────────────────────────────────────────
PORT DUES | PER GRT X 0.306 × 46668 | AS PER PORT TARIFF
                              MANDATORY 15%VAT + 10% AIT   ←right-aligned
```

**`'hyphen'`:**
```
PORT DUES - PER GRT X 0.306 × 46668 - AS PER PORT TARIFF
```

The `surchargeLabel` is ALWAYS right-aligned, regardless of separator style. It visually belongs to the right side of the details column.

### Multi-Value Row in PDF

```
SL  DETAILS                                    USD         USD
────────────────────────────────────────────────────────────────
04  TUGBOAT HIRE CHARGES
    Arrival Tugboat Hire                       800.00
    Sailing Tugboat Hire                       800.00
                        MANDATORY 15%VAT + 5% AIT   1,600.00  1,920.00
```

Component labels are indented. The SL# (04) appears only once. The base value and total value appear on the last line of the multi-value row.

### Header Label Row in PDF

```
    ──── AGENCY COSTS & MISCELLANEOUS ────
```

Rendered as a visual divider or bold heading line with no SL# and no value columns.

### invisible Rows (`isVisible = false`)

Not rendered at all in the PDF. Not given an SL#. Computed and used by other rows but invisible to the client. Used for intermediate calculations like "subtotal before agency fee" that other rows depend on but the client doesn't need to see.

---

## 13. Important Edge Cases and Rules

1. **A `section_aggregate` row that targets its own section** does not create a circular dependency — `SECTION_SUM` is a built-in resolved token, not a reference to another row. The DAG validator treats it as a leaf node.

2. **A `section_aggregate` row targeting an empty section** (no rows, or all rows are zero): `SECTION_SUM = 0`, the formula evaluates to 0. This is valid and produces no error.

3. **A `manual` row with no staff input**: `baseValue = 0`. The preview shows 0. The frozen invoice saves 0. This is valid.

4. **Multiple `section_aggregate` rows targeting the same section**: Valid. Each one applies its own formula to the same `SECTION_SUM`. One can be a VAT row and another can be an AIT row, both summing the same section.

5. **`ROW_*` token in a `section_aggregate` formula**: Valid. For example: `"SECTION_SUM * {{ROW_AGENCY_FEE_RATE}}"` where `AGENCY_FEE_RATE` is another row that computed a dynamic rate. The DAG handles this correctly.

6. **`isVisible = false` row referenced by other formulas**: The row still evaluates and its `totalValue` is added to scope as `ROW_{rowToken}`. It participates in `SECTION_SUM`. It just doesn't appear in the PDF.

7. **Changing a constant row's `constantValue` in the template AFTER an invoice has been frozen**: The frozen invoice is unaffected — it stores the line item's `baseValue` directly. The `historicalFormat` JSONB stores the `constantValue` as it was at freeze time.

8. **A `formula` row where the formula evaluates to a negative number**: Allowed. This represents a credit, discount, or deduction. The preview and PDF show the negative value.

9. **Row reordering does NOT trigger re-validation unless `sortOrder` changes affect topological ordering** — since the DAG is based on formula references, not sort order, reordering is safe without re-running the full validator.

10. **The `rowToken` for `OVERRIDE_*` staff rows**: These tokens are auto-generated sequentially and are scoped to the draft/invoice. They cannot be referenced by template rows. They are only for ad-hoc additions by staff and do not exist in the template layer.
