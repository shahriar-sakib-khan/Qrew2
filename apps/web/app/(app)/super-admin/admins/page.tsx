import { SuperAdminUsersTable } from "@/components/features/super-admin/super-admin-users-table";

export default function ManageAdminsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-destructive">Manage Administrators</h1>
        <p className="text-muted-foreground">Elevate or demote global system roles. Actions are fully audited.</p>
      </div>
      <SuperAdminUsersTable />
    </div>
  );
}
