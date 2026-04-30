import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 1. Define the sleep function outside your component (or import it from a utils file)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function DashboardPage() {
  // 2. AWAIT THE SLEEP AT THE VERY TOP OF THE COMPONENT
  // This forces Next.js to immediately render apps/web/app/dashboard/loading.tsx
  // and hold it on screen for exactly 3 seconds.
  await sleep(3000);

  // 3. Your actual data fetching happens down here...
  // const data = await db.query...
  // const session = await getSession...

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Generate 12 dummy cards to force a massive vertical scroll */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="bg-card/40 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Metric Widget {i + 1}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full rounded-md border border-dashed border-border/50 bg-muted/20 flex items-center justify-center text-muted-foreground">
                Chart Data Placeholder
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    );
}
