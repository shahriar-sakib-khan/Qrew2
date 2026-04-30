export default function SuperAdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-destructive">System Core</h1>
      <div className="rounded-lg border border-dashed border-destructive/30 h-[400px] flex items-center justify-center text-muted-foreground bg-destructive/5">
        Global tenant metrics and database controls will be mounted here.
      </div>
    </div>
  );
}
