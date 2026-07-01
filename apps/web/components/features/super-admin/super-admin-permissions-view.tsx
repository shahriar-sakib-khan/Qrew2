"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Permission {
  id: string;
  key: string;
  category: string;
  description: string;
}

// Helper to group permissions by logical action type
function getPermissionType(key: string): "read" | "write" | "danger" | "other" {
  const action = key.split(":")[1];
  if (!action) return "other";
  
  if (action.startsWith("view")) return "read";
  if (["create", "edit", "request", "approve", "record", "manage", "invite"].some(a => action.startsWith(a))) return "write";
  if (["delete", "archive", "restore", "revoke"].some(a => action.startsWith(a))) return "danger";
  
  return "other";
}

export function SuperAdminPermissionsView() {
  const { data: permissions, isLoading, error } = useQuery<Permission[]>({
    queryKey: ["super-admin-permissions"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/permissions`);
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Permissions</CardTitle>
          <CardDescription>Could not connect to the server.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Group permissions by category
  const grouped = (permissions || []).reduce((acc: Record<string, Permission[]>, perm) => {
    const cat = perm.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, perms]) => {
        // Sub-group by type within the category
        const readPerms = perms.filter(p => getPermissionType(p.key) === "read");
        const writePerms = perms.filter(p => getPermissionType(p.key) === "write");
        const dangerPerms = perms.filter(p => getPermissionType(p.key) === "danger");
        const otherPerms = perms.filter(p => getPermissionType(p.key) === "other");

        const renderGroup = (groupPerms: Permission[]) => {
          if (groupPerms.length === 0) return null;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 last:mb-0">
              {groupPerms.map((perm) => (
                <div
                  key={perm.key}
                  className="p-6 rounded-2xl border bg-card flex flex-col gap-3 shadow-md hover:shadow-lg transition-shadow items-start"
                >
                  <Badge 
                    variant={getPermissionType(perm.key) === "danger" ? "destructive" : "secondary"} 
                    className="font-mono font-extrabold text-[15px] px-4 py-1.5 shadow-sm"
                  >
                    {perm.key}
                  </Badge>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    {perm.description || "No description provided."}
                  </p>
                </div>
              ))}
            </div>
          );
        };

        return (
          <Card key={category}>
            <CardHeader className="bg-muted/40 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {category}
              </CardTitle>
              <CardDescription>
                {perms.length} {perms.length === 1 ? "permission" : "permissions"} available in this section.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-2">
              {renderGroup(readPerms)}
              {renderGroup(writePerms)}
              {renderGroup(dangerPerms)}
              {renderGroup(otherPerms)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
