"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Building2, ChevronRight, ArrowRight, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { QrewLogo } from "@/components/ui/logo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export function OrganizationPortalView() {
  const router = useRouter();
  
  // State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");

  // Fetch the user's organizations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      let shouldTurnOffLoader = true; // Default to turning it off

      try {
        const { data: sessionData } = await authClient.getSession();
        const currentActiveId = sessionData?.session?.activeOrganizationId;
        
        if (sessionData?.user) {
          setUser(sessionData.user);
        }

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
    setIsDialogOpen(false);
    
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

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/");
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
    <div className="flex flex-col min-h-screen bg-background/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
        >
          <QrewLogo className="h-8 w-8" />
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Qrew</span>
        </button>
        
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-medium leading-none">{user.name}</span>
                <span className="text-xs text-muted-foreground mt-1">{user.email}</span>
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {user.name?.substring(0, 2).toUpperCase() || "US"}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="h-6 w-px bg-border hidden sm:block"></div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </header>

      {/* Main Content - Centered */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-2xl mx-auto">
        <div className="w-full space-y-8">
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Your Workspaces</h1>
            <p className="text-muted-foreground">Select an organization to continue or create a new one.</p>
          </div>

          {organizations.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none border-2">
              <CardContent className="flex flex-col items-center justify-center h-64 text-center p-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No workspaces found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-8">
                  You don't belong to any active organizations yet. Create your first workspace to get started.
                </p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full sm:w-auto">
                      <Plus className="h-5 w-5 mr-2" /> Create Workspace
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create Workspace</DialogTitle>
                      <DialogDescription>
                        Establish a new company or branch.
                      </DialogDescription>
                    </DialogHeader>
                    <form id="create-org-form" onSubmit={handleCreateOrganization} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="orgName">Organization Name</Label>
                        <Input 
                          id="orgName" 
                          placeholder="e.g. Acme Corp" 
                          value={newOrgName} 
                          onChange={handleNameChange}
                          required
                          disabled={isCreating}
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
                            disabled={isCreating}
                          />
                        </div>
                      </div>
                    </form>
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        form="create-org-form" 
                        className="w-full" 
                        disabled={isCreating || !newOrgName}
                      >
                        {isCreating ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Provisioning...</>
                        ) : (
                          <>Create & Enter <ArrowRight className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3">
                {organizations.map((org) => (
                  <Card 
                    key={org.id} 
                    className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSwitching === org.id ? 'border-primary ring-1 ring-primary' : ''}`}
                    onClick={() => handleSelectOrganization(org.id)}
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold uppercase text-lg">
                          {org.name.substring(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{org.name}</h3>
                          <p className="text-sm text-muted-foreground">/{org.slug}</p>
                        </div>
                      </div>
                      {isSwitching === org.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-center pt-4">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto border-dashed">
                      <Plus className="h-4 w-4 mr-2" /> Create New Workspace
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create Workspace</DialogTitle>
                      <DialogDescription>
                        Establish a new company or branch.
                      </DialogDescription>
                    </DialogHeader>
                    <form id="create-org-form-2" onSubmit={handleCreateOrganization} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="orgName2">Organization Name</Label>
                        <Input 
                          id="orgName2" 
                          placeholder="e.g. Acme Corp" 
                          value={newOrgName} 
                          onChange={handleNameChange}
                          required
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orgSlug2">Workspace URL Slug</Label>
                        <div className="flex items-center">
                          <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                            qrew.com/
                          </span>
                          <Input 
                            id="orgSlug2" 
                            className="rounded-l-none" 
                            value={newOrgSlug} 
                            onChange={(e) => setNewOrgSlug(e.target.value)}
                            required
                            disabled={isCreating}
                          />
                        </div>
                      </div>
                    </form>
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        form="create-org-form-2" 
                        className="w-full" 
                        disabled={isCreating || !newOrgName}
                      >
                        {isCreating ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Provisioning...</>
                        ) : (
                          <>Create & Enter <ArrowRight className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
