"use client";

/**
 * dashboard/layout.tsx
 * The main dashboard shell layout.
 * PBAC filtering for nav items:
 *   - NavItem entries with a `permission` key are filtered by can().
 *   - NavGroup entries are filtered by their own top-level permission key.
 *   - Individual group children are filtered inside SidebarNavGroup itself.
 */

import { AppShell } from "@/components/layout/app-shell";
import { NAV_CONFIG } from "@/lib/config/navigation";
import type { NavGroup, NavItem, AnyNavItem } from "@/lib/config/navigation";
import { useSession } from "@/lib/auth-client";
import { usePermissionStore } from "@/store/use-permission-store";
import { useMemo } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const permissions = usePermissionStore(state => state.permissions);
  const can = usePermissionStore(state => state.can);

  const navItems = useMemo((): AnyNavItem[] => {
    return NAV_CONFIG.user.filter((item: AnyNavItem) => {
      // Check the item-level permission gate if present.
      const itemPermission = (item as NavItem).permission || (item as NavGroup).permission;
      if (itemPermission) return can(itemPermission);
      return true;
    });
  }, [can, permissions]);

  return (
    <AppShell session={session} navItems={navItems} theme="default">
      {children}
    </AppShell>
  );
}
