import { AuditLogsTable } from "@/components/features/super-admin/audit-logs-table";

export default function AuditLogsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-destructive">SOC2 Audit Logs</h1>
        <p className="text-muted-foreground">Immutable record of all super-admin and support agent security actions.</p>
      </div>
      <AuditLogsTable />
    </div>
  );
}
