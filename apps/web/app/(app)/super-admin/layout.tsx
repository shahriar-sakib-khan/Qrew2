"use client";

import { AppShell } from "@/components/layout/app-shell";
import { NAV_CONFIG } from "@/lib/config/navigation";
import { useSession } from "@/lib/auth-client";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <AppShell session={session} navItems={NAV_CONFIG.superAdmin} settingsItem={NAV_CONFIG.superAdminSettings} theme="destructive">
      <div className="theme-destructive h-full">
        {children}
      </div>
    </AppShell>
  );
}
