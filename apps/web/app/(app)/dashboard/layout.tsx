"use client";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_CONFIG } from "@/lib/config/navigation";
import { useSession } from "@/lib/auth-client";
import { usePermissionStore } from "@/store/use-permission-store";
import { useMemo } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { can } = usePermissionStore();

  const navItems = useMemo(() => {
    return NAV_CONFIG.user.filter(item => {
      if (item.name === "Invoices") return can("finance:view_invoices");
      return true;
    });
  }, [can]);

  return (
    <AppShell session={session} navItems={navItems} theme="default">
      {children}
    </AppShell>
  );
}
