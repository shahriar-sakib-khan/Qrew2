import { SettingsLayout } from "@/components/layout/settings-layout";

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout basePath="/admin">{children}</SettingsLayout>;
}
