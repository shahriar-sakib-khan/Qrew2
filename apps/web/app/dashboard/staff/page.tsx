import { StaffDataTable } from "@/components/features/staff/staff-data-table";

export default function StaffDirectoryPage() {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Team Directory</h1>
        <p className="text-muted-foreground text-sm">
          A complete roster of everyone in this workspace.
        </p>
      </div>

      <StaffDataTable isReadOnly={true} />
    </div>
  );
}
