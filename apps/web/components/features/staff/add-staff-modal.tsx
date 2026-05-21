"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddStaffModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // 1. Fetch available roles for the dropdown using TanStack Query
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["org-roles"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/roles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      return data.roles || []; // Assuming your GET /roles endpoint returns { roles: [...] }
    },
    enabled: isOpen, // Optimization: Only fetch roles when the modal is actually opened
  });

  // 2. Handle the Submission (Pattern 3 API)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !roleId) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/workspaces/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, roleId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to provision staff.");
      }

      toast.success(data.message || "Staff member provisioned successfully.");
      
      // Reset form and close modal
      setIsOpen(false);
      setName("");
      setEmail("");
      setRoleId("");
      
      // Hard refresh to update the staff table in the background
      router.refresh(); 
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Provision Staff Account</DialogTitle>
          <DialogDescription>
            Create a new account for a team member. They will receive an email to securely set their password.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              placeholder="e.g. Jane Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="jane@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Workspace Role</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={isLoading || isLoadingRoles} required>
              <SelectTrigger id="role">
                <SelectValue placeholder={isLoadingRoles ? "Loading roles..." : "Select a role"} />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role: any) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !email || !roleId}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Provisioning...</>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
