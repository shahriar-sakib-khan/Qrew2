# Template Sections Submodule

**Location:** `apps/api/src/features/invoice-templates/sections/agent.md`  
**Binding Architectural Contract for AI Agents**

---

## 1. Responsibilities
- Manages template sections (`template_sections`) and section-level charges (`template_section_charges`).
- Computes section-level charge formulas applied across row totals in that section.

## 2. Invariants & Rules
1. **Section Tokens**: `sectionToken` must be unique per template in `UPPER_SNAKE_CASE` (e.g., `PORT_EXPENSES`).
2. **Unified Formula Storage**: Section charges store a single complete `formula` expression (e.g., `SEC_A * 0.10`). Never split into base/rest fields.
3. **Formula Codec**: Formulas reference section tokens and row tokens. References to rows use the formula codec.
4. **Scope Boundaries**: Section charges cannot reference tokens outside their legal evaluation bounds.
5. **PBAC**: Handlers require `finance:manage_invoices` for write operations, `finance:view_invoices` for reads.

## 3. Files
- `template-sections.controller.ts`: Section CRUD, sortOrder, uniqueness checks.
- `template-sections.test.ts`: Test coverage for section lifecycle.
- `template-section-charges.controller.ts`: Section charge CRUD, formula syntax validation.
- `template-section-charges.test.ts`: Test coverage for section charges.
