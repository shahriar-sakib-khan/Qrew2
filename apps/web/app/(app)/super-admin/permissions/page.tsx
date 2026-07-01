import { SuperAdminPermissionsView } from "@/components/features/super-admin/super-admin-permissions-view";

export const metadata = {
  title: "System Permissions Registry",
  description: "View all hardcoded permissions available across the system.",
};

export default function SuperAdminPermissionsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System Permissions Registry</h1>
        <p className="text-muted-foreground">
          A read-only view of all granular PBAC permissions hardcoded into the system backend. These are bundled into Roles by organization admins.
        </p>
      </div>

      <SuperAdminPermissionsView />
    </div>
  );
}
