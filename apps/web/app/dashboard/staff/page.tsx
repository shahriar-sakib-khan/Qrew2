import { Can } from "@/components/ui/can";
import { AddStaffModal } from "@/components/features/staff/add-staff-modal";
// ... other imports (e.g., your data table)

export default function StaffDirectoryPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground text-sm">Manage your team and their workspace roles.</p>
        </div>
        
        {/* The PBAC Enforcement */}
        <Can I="staff:provision">
          <AddStaffModal />
        </Can>
      </div>

      {/* <StaffDataTable /> */}
    </div>
  );
}
