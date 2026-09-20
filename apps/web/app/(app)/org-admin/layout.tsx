"use client";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_CONFIG } from "@/lib/config/navigation";
import { useSession } from "@/lib/auth-client";

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  return (
    <AppShell 
      session={session} 
      navItems={NAV_CONFIG.tenantAdmin} 
      settingsItem={NAV_CONFIG.tenantAdminExit}
      theme="admin"
      showOrgSwitcher={false}
    >
      {children}
    </AppShell>
  );
}
