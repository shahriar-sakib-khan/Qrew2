import { SettingsLayout } from "@/components/layout/settings-layout";

export default function DashboardSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout basePath="/dashboard">{children}</SettingsLayout>;
}
