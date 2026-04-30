"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Building2, ChevronRight, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { QrewLogo } from "@/components/ui/logo";
import { toast } from "sonner"; // Assuming you use Sonner for toasts

export function OrganizationPortalView() {
  const router = useRouter();
  
  // State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");

  // Fetch the user's organizations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      let shouldTurnOffLoader = true; // Default to turning it off

      try {
        const { data: sessionData } = await authClient.getSession();
        const currentActiveId = sessionData?.session?.activeOrganizationId;

        const { data, error } = await authClient.organization.list();
        if (error) throw error;
        
        const fetchedOrgs = data || [];
        setOrganizations(fetchedOrgs);

        // THE 1-ORG AUTO-ROUTER
        if (fetchedOrgs.length === 1 && !currentActiveId) {
          shouldTurnOffLoader = false; // TRAP THE SPINNER: Do not let it turn off!
          await handleSelectOrganization(fetchedOrgs[0].id);
          return; 
        }

      } catch (err) {
        toast.error("Failed to load workspaces.");
      } finally {
        // Only turn off the spinner if we are staying on this page
        if (shouldTurnOffLoader) {
          setIsLoading(false);
        }
      }
    };
    fetchOrgs();
  }, []);

  // Auto-generate a slug from the organization name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewOrgName(name);
    setNewOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  // Handle Organization Creation
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug) return;

    setIsCreating(true);
    
    // Better Auth Organization Creation API
    const { data, error } = await authClient.organization.create({
      name: newOrgName,
      slug: newOrgSlug,
    });

    if (error) {
      toast.error(error.message || "Failed to create workspace.");
      setIsCreating(false);
      return;
    }

    toast.success("Workspace created successfully!");
    
    // Immediately set this new org as active and route to dashboard
    if (data) {
      await handleSelectOrganization(data.id);
    }
  };

  // Handle Organization Selection
  const handleSelectOrganization = async (orgId: string) => {
    setIsSwitching(orgId);
    
    // Tell Better Auth to set this specific Org as the active session context
    const { error } = await authClient.organization.setActive({
      organizationId: orgId,
    });

    if (error) {
      toast.error("Failed to enter workspace.");
      setIsSwitching(null);
      return;
    }

    // Success! The session cookie is updated. Send them to the dashboard.
    router.push("/dashboard");
    router.refresh(); // Force a hard refresh to wipe any cached layout state
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your workspaces...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-8 z-10">
        <QrewLogo className="h-12 w-12" />
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
        
        {/* LEFT COLUMN: Existing Organizations List */}
        <div className="flex flex-col space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Workspaces</h2>
            <p className="text-muted-foreground text-sm">Select an organization to continue.</p>
          </div>

          {organizations.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6">
                <Building2 className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                <p className="text-sm font-medium">No workspaces found</p>
                <p className="text-xs text-muted-foreground mt-1">Create one on the right to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <Card 
                  key={org.id} 
                  className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${isSwitching === org.id ? 'border-primary ring-1 ring-primary' : ''}`}
                  onClick={() => handleSelectOrganization(org.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold uppercase">
                        {org.name.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{org.name}</h3>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                    {isSwitching === org.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Create New Organization */}
        <div className="flex flex-col h-full">
          <Card className="flex-1 shadow-xl border-border/50 bg-background/80 backdrop-blur-xl flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-500" /> Create Workspace
              </CardTitle>
              <CardDescription>Establish a new company or branch.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <form id="create-org-form" onSubmit={handleCreateOrganization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input 
                    id="orgName" 
                    placeholder="e.g. Acme Corp" 
                    value={newOrgName} 
                    onChange={handleNameChange}
                    required
                    disabled={isCreating || isSwitching !== null}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Workspace URL Slug</Label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                      qrew.com/
                    </span>
                    <Input 
                      id="orgSlug" 
                      className="rounded-l-none" 
                      value={newOrgSlug} 
                      onChange={(e) => setNewOrgSlug(e.target.value)}
                      required
                      disabled={isCreating || isSwitching !== null}
                    />
                  </div>
                </div>
              </form>
            </CardContent>
            <CardFooter className="pt-4 border-t">
              <Button 
                type="submit" 
                form="create-org-form" 
                className="w-full" 
                disabled={isCreating || isSwitching !== null || !newOrgName}
              >
                {isCreating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Provisioning...</>
                ) : (
                  <>Create & Enter <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
      </div>
    </div>
  );
}
