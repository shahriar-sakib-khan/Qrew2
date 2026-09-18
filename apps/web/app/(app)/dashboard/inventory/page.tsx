/**
 * dashboard/inventory/page.tsx
 * Redirect: /dashboard/inventory → /dashboard/inventory/products
 * The Products page is now the primary landing page for the inventory module.
 */

import { redirect } from "next/navigation";

export default function InventoryIndexPage() {
  redirect("/dashboard/inventory/products");
}
