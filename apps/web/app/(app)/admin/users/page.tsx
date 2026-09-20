import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { UsersDataTable } from "@/components/features/admin/users-data-table";

export default function ManageUsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Manage Staff & Users</h1>
        <p className="text-sm text-muted-foreground">
          Search and view system roles for all registered users across the platform.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center h-[300px] border border-border/50 border-dashed rounded-lg bg-card/10 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span>Initializing database stream...</span>
          </div>
        }
      >
        <UsersDataTable />
      </Suspense>
    </div>
  );
}
