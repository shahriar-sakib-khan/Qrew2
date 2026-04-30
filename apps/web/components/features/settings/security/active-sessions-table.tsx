"use client";

import { useState, useEffect } from "react";
import { Laptop, Smartphone, Trash2, Loader2 } from "lucide-react";
import { UAParser } from "ua-parser-js";
import { authClient, useSession } from "@/lib/auth-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export function ActiveSessionsTable() {
  const { data: currentSession } = useSession();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    // Better Auth client automatically fetches all active sessions for this user
    const { data, error } = await authClient.listSessions();
    if (data) setSessions(data);
    setIsLoading(false);
  };

  const handleRevoke = async (token: string) => {
    setRevokingId(token);
    const { error } = await authClient.revokeSession({ token });
    if (!error) {
      setSessions((prev) => prev.filter((s) => s.token !== token));
    }
    setRevokingId(null);
  };

  const parseUserAgent = (uaString: string) => {
    const parser = new UAParser(uaString);
    const result = parser.getResult();
    const device = result.device.type === "mobile" ? "Mobile" : result.os.name || "Desktop";
    const browser = result.browser.name || "Unknown Browser";
    return { name: `${device} - ${browser}`, isDesktop: result.device.type !== "mobile" };
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground h-6 w-6" /></div>;

  return (
    <div className="rounded-md border border-border/50 bg-card/40 backdrop-blur-sm w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Device</TableHead>
            {/* Hide these headers on mobile screens */}
            <TableHead className="hidden sm:table-cell">IP Address</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No active sessions found.</TableCell>
            </TableRow>
          ) : (
            sessions.map((session) => {
              const { name, isDesktop } = parseUserAgent(session.userAgent || "");
              const isCurrent = session.id === currentSession?.session?.id;

              return (
                <TableRow key={session.id}>
                  <TableCell className="font-medium align-top sm:align-middle">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="mt-1 sm:mt-0">
                        {isDesktop ? <Laptop className="h-4 w-4 text-muted-foreground" /> : <Smartphone className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{name}</span>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                              Current
                            </span>
                          )}
                        </div>
                        {/* Mobile-only view: Stack the IP and Date under the device name so they don't scroll off-screen */}
                        <div className="sm:hidden flex flex-col text-xs text-muted-foreground font-normal">
                          <span>{session.ipAddress || "Unknown IP"}</span>
                          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {/* Hide these exact cells on mobile */}
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{session.ipAddress || "Unknown IP"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right align-top sm:align-middle">
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                        onClick={() => handleRevoke(session.token)}
                        disabled={revokingId === session.token}
                      >
                        {revokingId === session.token ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 sm:mr-2" />}
                        {/* Hide text on very small screens to save space, keeping just the icon */}
                        <span className="hidden sm:inline">Revoke</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
