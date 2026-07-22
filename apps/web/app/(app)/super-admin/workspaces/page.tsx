import { WorkspacesTable } from "@/components/features/super-admin/workspaces-table";

export default function SuperAdminWorkspacesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground">Manage all organizations across the platform.</p>
      </div>
      <WorkspacesTable />
    </div>
  );
}
