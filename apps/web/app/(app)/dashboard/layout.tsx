"use client";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_CONFIG } from "@/lib/config/navigation";
import { useSession } from "@/lib/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  return (
    <AppShell session={session} navItems={NAV_CONFIG.user} settingsItem={NAV_CONFIG.userSettings} theme="default">
      {children}
    </AppShell>
  );
}
