"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from "@/lib/constants";

interface AuditLog {
  id: string;
  action: string;
  reason: string;
  ipAddress: string;
  createdAt: string;
  adminId: string;
  targetUserId: string;
  adminEmail: string;
  targetEmail: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface AuditLogsResponse {
  data: AuditLog[];
  meta: PaginationMeta;
}

export function AuditLogsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const limit = 20;

  const { data, isLoading, isPlaceholderData } = useQuery<AuditLogsResponse>({
    queryKey: ["super-admin-audit-logs", page],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/super-admin/audit-logs?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 10000,
  });

  const handlePageChange = (newPage: number) => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set("page", newPage.toString());
    router.push(`${pathname}?${currentParams.toString()}`);
  };

  const logs = data?.data || [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages || 1;

  const getActionColor = (action: string) => {
    if (action.includes("BAN") || action.includes("NUKE")) return "bg-destructive/10 text-destructive border-destructive/20";
    if (action.includes("IMPERSONATE")) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    if (action.includes("ELEVATE")) return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/10">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[150px]">Action</TableHead>
              <TableHead className="w-[200px]">Actor (Admin)</TableHead>
              <TableHead className="w-[200px]">Target User</TableHead>
              <TableHead className="w-[300px]">SOC2 Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="h-8 w-8 stroke-1 text-muted-foreground/60" />
                    <span>No security actions recorded yet.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    isPlaceholderData ? "opacity-70" : ""
                  }`}
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getActionColor(log.action)} uppercase text-[10px] tracking-wider`} variant="outline">
                      {log.action.replace("SECURITY_ENFORCEMENT_", "")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.adminEmail}
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{log.ipAddress}</div>
                  </TableCell>
                  <TableCell>{log.targetEmail}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={log.reason}>
                    {log.reason}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="text-xs text-muted-foreground">
            Page {meta?.page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta!.page - 1)}
              disabled={meta!.page <= 1 || isLoading}
              className="gap-1 h-8"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta!.page + 1)}
              disabled={meta!.page >= totalPages || isLoading}
              className="gap-1 h-8"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
