import { SettingsLayout } from "@/components/layout/settings-layout";

export default function SuperAdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout basePath="/super-admin">{children}</SettingsLayout>;
}
