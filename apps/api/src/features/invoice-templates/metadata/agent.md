# Template Metadata Submodule (Constants & Headers)

**Location:** `apps/api/src/features/invoice-templates/metadata/agent.md`  
**Binding Architectural Contract for AI Agents**

---

## 1. Responsibilities
- Manages template-level constants (`template_constants`).
- Manages template header fields (`template_header_fields`).

## 2. Invariants & Rules
1. **Constants**:
   - `constantToken` must be unique per template in `UPPER_SNAKE_CASE`.
   - Stored as fixed numeric strings in database, evaluated as literal constant values.
   - Note: Route middleware `requireOrgPermission` guards authorization; preserve this check.
2. **Header Fields**:
   - Metadata key/value descriptors (e.g. `INVOICE_NUMBER`, `ISSUE_DATE`, `CLIENT_REF`).
   - `TemplateHeaderFieldsController.deleteHeaderField` returns the deleted entity object (pinned by test suite).
3. **PBAC**: Handlers require `finance:manage_invoices` for write operations, `finance:view_invoices` for reads.

## 3. Files
- `template-constants.controller.ts`: Constants CRUD and uniqueness checks.
- `template-constants.test.ts`: Test suite for constants.
- `template-header-fields.controller.ts`: Header fields CRUD.
- `template-header-fields.test.ts`: Test suite for header fields.
