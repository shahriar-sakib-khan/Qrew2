"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Building2, Loader2, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { usePermissionStore } from "@/store/use-permission-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function OrganizationSwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const { loadPermissions } = usePermissionStore();

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        // Fetch session to get the currently active org
        const { data: sessionData } = await authClient.getSession();
        setActiveOrgId(sessionData?.session?.activeOrganizationId || null);

        // Fetch all organizations the user belongs to
        const { data: orgsData } = await authClient.organization.list();
        setOrganizations(orgsData || []);
      } catch (error) {
        console.error("Failed to fetch organizations", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrgData();
  }, []);

  const activeOrg = organizations.find((org) => org.id === activeOrgId);

  const handleSwitchOrganization = async (orgId: string) => {
    if (orgId === activeOrgId) return; // Already active
    
    setIsSwitching(true);
    const { error } = await authClient.organization.setActive({ organizationId: orgId });
    
    if (error) {
      toast.error("Failed to switch workspace.");
      setIsSwitching(false);
      return;
    }

    // THE FIX: Immediately reload permissions for the new organization
    await loadPermissions();

    // Success: Update local state and hard refresh to clear any cached tenant data
    setActiveOrgId(orgId);
    setIsSwitching(false);
    toast.success("Workspace switched.");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 w-full animate-pulse bg-muted rounded-md" />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a workspace"
          className={cn(
            "w-full justify-between bg-background hover:bg-muted/50 border-border/50",
            isCollapsed ? "px-2" : "px-3"
          )}
          disabled={isSwitching}
        >
          {isCollapsed ? (
            <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 text-primary font-bold">
              {activeOrg?.name?.charAt(0).toUpperCase() || <Building2 className="h-4 w-4" />}
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 text-primary font-bold shrink-0">
                {activeOrg?.name?.charAt(0).toUpperCase() || <Building2 className="h-4 w-4" />}
              </div>
              <span className="truncate font-medium">{activeOrg?.name || "Select Workspace"}</span>
            </div>
          )}
          
          {!isCollapsed && (
            isSwitching ? (
              <Loader2 className="ml-auto h-4 w-4 shrink-0 opacity-50 animate-spin" />
            ) : (
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            )
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-[240px] bg-background/95 backdrop-blur-xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Workspaces
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitchOrganization(org.id)}
            className="cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 text-primary font-bold shrink-0">
                {org.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{org.name}</span>
            </div>
            {activeOrgId === org.id && <Check className="h-4 w-4 text-emerald-500" />}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => router.push("/onboarding/organization")}
          className="cursor-pointer text-emerald-600 focus:text-emerald-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
