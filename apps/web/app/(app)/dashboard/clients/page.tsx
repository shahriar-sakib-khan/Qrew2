export default function ClientsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Client Directory</h1>
      <div className="rounded-lg border border-dashed border-border/50 h-[400px] flex items-center justify-center text-muted-foreground bg-card/10">
        Client profiles, histories, and ledgers will be mounted here.
      </div>
    </div>
  );
}
