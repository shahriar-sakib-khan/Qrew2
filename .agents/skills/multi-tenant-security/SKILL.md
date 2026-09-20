---
name: multi-tenant-security
description: Mandatory security protocols for database isolation, PBAC, and multi-tenant scoping.
---

# Multi-Tenant Security & PBAC Protocol

Security is the highest priority. All API endpoints and database queries MUST strictly adhere to this protocol.

## 1. Multi-Tenant Scoping (Critical)
- **The Rule:** EVERY database query (Select, Update, Delete) MUST include \`eq(table.organizationId, orgId)\` in its \`.where()\` clause.
- **Why:** To guarantee horizontal data isolation between tenants. 
- **Anti-Pattern:** Relying solely on a \`findFirst\` check to verify ownership, and then performing an un-scoped \`.update()\` or \`.delete()\` using only the record ID. This is vulnerable to race conditions.
- **Correct Implementation:**
  \`\`\`typescript
  // For Updates and Deletes:
  await db.update(table)
    .set({ data })
    .where(and(eq(table.id, id), eq(table.organizationId, orgId)));
  \`\`\`

## 2. Permission-Based Access Control (PBAC)
- **Seeding Permissions:** Whenever a new feature or module is created, its corresponding permission string (e.g., \`inventory:manage_brands\`, \`finance:view_expenses\`) MUST be registered in \`packages/db/src/seed-permissions.ts\` under the \`INITIAL_PERMISSIONS\` array.
- **Controller Enforcement:** Controllers must verify these permissions using the authentication middleware before executing any business logic.

## 3. Financial & Computed Fields
- Financial totals, sensitive computed data, or analytics MUST be wrapped in explicit PBAC checks. 
- Do NOT govern these using standard "Custom Field" toggles. If the user lacks the specific hardcoded permission (e.g., \`finance:view_expenses\`), the field must be completely omitted from the payload/UI.
