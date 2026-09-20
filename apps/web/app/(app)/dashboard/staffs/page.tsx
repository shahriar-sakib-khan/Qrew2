import { StaffDataTable } from "@/components/features/staff/staff-data-table";

export default function StaffsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Office Staff</h1>
        <p className="text-muted-foreground mt-1">Directory of all members in the office.</p>
      </div>
      
      <StaffDataTable isReadOnly={true} />
    </div>
  );
}
