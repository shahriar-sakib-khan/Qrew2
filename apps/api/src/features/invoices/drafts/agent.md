# Invoice Drafts Submodule

**Location:** `apps/api/src/features/invoices/drafts/agent.md`  
**Binding Architectural Contract for AI Agents**

---

## 1. Core Responsibilities
- Manages the lifecycle of invoice drafts (`invoice_drafts` table).
- Implements staff fill-time editing without mutating the underlying master template.
- Manages snapshot seeding from invoice templates into draft JSONB state via `DraftSeeder`.

## 2. Invariants & Rules
1. **JSONB Isolation**: When an invoice draft is created from a template, all sections, rows, charges, constants, and headers are copied into the draft's JSONB snapshot. Any subsequent changes to master templates do NOT mutate existing drafts.
2. **Token Immutability in Drafts**: Once a draft is initialized, row tokens and charge tokens are immutable to ensure formula resolution consistency.
3. **Manual Values vs Formulas**: In draft fill mode, rows with `valueType = 'normal'` accept staff overrides (`manualValue`). Formulas remain engine-computed.
4. **PBAC**: Access requires `finance:manage_invoices` for creation, upsert, and deletion; `finance:view_invoices` for listing and retrieval.

## 3. Files
- `drafts.controller.ts`: REST endpoints for draft list, get, create, upsert, delete, and duplicate.
- `draft-builder.controller.ts`: Customizer endpoints for managing draft-level sections, rows, and charges.
- `draft-seeder.ts`: Reads template definitions and relations from DB to produce initial draft JSONB structures.
