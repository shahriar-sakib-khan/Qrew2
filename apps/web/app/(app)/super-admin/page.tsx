"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Activity, Database, ServerCrash, Skull, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { apiUrl } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function SuperAdminPage() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/system/health`);
      if (!res.ok) {
        if (res.status !== 503) throw new Error("Failed to fetch system health");
      }
      return res.json();
    },
    refetchInterval: 10000, // Poll every 10s
  });

  const [nukeConfirm, setNukeConfirm] = useState("");
  const [nukeOpen, setNukeOpen] = useState(false);

  const nukeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/super-admin/nuke-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to execute nuke.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Global Session Nuke Executed Successfully.");
      setNukeOpen(false);
      setNukeConfirm("");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-destructive">System Core</h1>
          <p className="text-muted-foreground">Global infrastructure health and emergency controls.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Postgres Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PostgreSQL</CardTitle>
            <Database className={`h-4 w-4 ${health?.database === "connected" ? "text-green-500" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "Checking..." : (health?.database === "connected" ? "Operational" : "Offline")}
            </div>
            <p className="text-xs text-muted-foreground">
              Primary transactional database.
            </p>
          </CardContent>
        </Card>

        {/* Redis Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <ServerCrash className={`h-4 w-4 ${health?.redis === "connected" ? "text-green-500" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "Checking..." : (health?.redis === "connected" ? "Operational" : "Offline")}
            </div>
            <p className="text-xs text-muted-foreground">
              Rate limiting and session caching.
            </p>
          </CardContent>
        </Card>

        {/* Overall Status */}
        <Card className={health?.status === "ok" ? "" : "border-destructive bg-destructive/5"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className={`h-4 w-4 ${health?.status === "ok" ? "text-green-500" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase tracking-wider">
              {isLoading ? "Checking..." : health?.status}
            </div>
            <p className="text-xs text-muted-foreground">
              Updated {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "..."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-destructive mb-4">Emergency Controls</h2>
        <Card className="border-destructive bg-destructive/5 shadow-none">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Skull className="h-5 w-5" />
              Global Session Nuke
            </CardTitle>
            <CardDescription className="text-destructive/80 font-medium">
              Immediately invalidates all active user sessions system-wide. Your current super-admin session will be preserved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={nukeOpen} onOpenChange={setNukeOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="font-bold tracking-wider">
                  INITIATE NUKE
                </Button>
              </DialogTrigger>
              <DialogContent className="border-destructive">
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <Skull className="h-5 w-5" />
                    CONFIRM GLOBAL NUKE
                  </DialogTitle>
                  <DialogDescription className="font-medium">
                    This action is <strong className="text-foreground">IRREVERSIBLE</strong>. 
                    It will force every user in the system to log back in immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    To confirm, please type <strong className="text-foreground font-mono select-none">NUKE SESSIONS</strong> below.
                  </p>
                  <Input 
                    value={nukeConfirm} 
                    onChange={(e) => setNukeConfirm(e.target.value)} 
                    placeholder="NUKE SESSIONS" 
                    className="font-mono uppercase"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setNukeOpen(false); setNukeConfirm(""); }}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    disabled={nukeConfirm !== "NUKE SESSIONS" || nukeMutation.isPending}
                    onClick={() => nukeMutation.mutate()}
                  >
                    {nukeMutation.isPending ? "Executing..." : "EXECUTE"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
