import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardGenericLoading() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Page Header Area Skeleton */}
      <div className="flex items-center justify-between space-y-2">
        <Skeleton className="h-9 w-[250px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>

      {/* Top Stat Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content / Table Area Skeleton */}
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-[200px] mb-2" />
          <Skeleton className="h-4 w-[300px]" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
