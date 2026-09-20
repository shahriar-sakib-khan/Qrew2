import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardGenericLoading() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Page Header Area Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[260px]" />
            <Skeleton className="h-6 w-[100px] rounded-full" />
          </div>
          <Skeleton className="h-4 w-[340px] mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[180px] rounded-lg" />
          <Skeleton className="h-8 w-[110px] rounded-md" />
          <Skeleton className="h-8 w-[95px] rounded-md" />
        </div>
      </div>

      {/* Top Stat Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/50 bg-card/40 backdrop-blur-sm shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle Row: Chart & Recent Invoices */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-6 w-[220px] mb-2" />
              <Skeleton className="h-4 w-[300px]" />
            </div>
            <Skeleton className="h-7 w-[140px] rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[310px] w-full mt-2" />
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/50 bg-card/40 backdrop-blur-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-5 w-[140px] mb-1" />
              <Skeleton className="h-3 w-[180px]" />
            </div>
            <Skeleton className="h-6 w-[70px]" />
          </CardHeader>
          <CardContent className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Files */}
      <div className="grid gap-4 grid-cols-1">
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <Skeleton className="h-6 w-[240px] mb-1" />
              <Skeleton className="h-4 w-[320px]" />
            </div>
            <Skeleton className="h-8 w-[90px]" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

