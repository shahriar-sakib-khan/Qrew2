---
name: rbac-architecture
description: Rules for enforcing Permission-Based Access Control (PBAC/RBAC) in frontend React components and navigation.
---

# Frontend RBAC & UI Permissions Architecture

While the backend enforces security at the data layer, the frontend must provide a secure and UX-friendly experience by hiding unauthorized actions using our Role-Based Access Control (RBAC) architecture.

## 1. The \`<Can>\` Wrapper Component
- **Rule:** Any UI component that exposes sensitive data, financial metrics, or administrative actions (e.g., delete buttons, settings forms, computed revenue fields) MUST be wrapped in the \`<Can>\` authorization component.
- **Syntax:**
  \`\`\`tsx
  <Can I="finance:view_expenses">
    <TotalExpensesChart />
  </Can>
  \`\`\`
- **Fallback:** Do not rely on generic Boolean state checks (\`if (isAdmin)\`). Always map the action to a granular permission string defined in \`seed-permissions.ts\`.

## 2. Navigation & Routing
- Hiding a link in the sidebar is NOT enough. 
- If a page route requires specific permissions, you must implement a permission check at the page-level (or layout-level) and render a \`<Unauthorized />\` or \`404\` component if the user forces navigation to that URL.

## 3. Financial & Computed Data Rule
- As per the Data Field Categorization rule, financial computed fields (e.g., \`totalRevenue\`, \`invoiceCount\`) MUST NOT be governed by a generic user-facing "Private" toggle.
- They must be strictly governed by hardcoded RBAC permissions (e.g., \`<Can I="finance:view_metrics">\`). If the permission is absent, the component does not render.
