"use client";

import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/features/auth/can";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditStaffRoleModal } from "./edit-staff-role-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletHistoryModal } from "@/components/features/financials/wallet-history-modal";

interface StaffMember {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  roleName: string;
  roleId?: string;
  isSystem?: boolean;
  createdAt?: string;
  walletBalance?: number;
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffDataTableProps {
  isReadOnly?: boolean;
}

export function StaffDataTable({ isReadOnly = true }: StaffDataTableProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const router = useRouter();

  // State for Edit Modal and AlertDialog
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [revokingMember, setRevokingMember] = useState<StaffMember | null>(null);
  const [viewingMember, setViewingMember] = useState<StaffMember | null>(null);
  const [viewingWalletUser, setViewingWalletUser] = useState<StaffMember | null>(null);

  const { data: staff = [], isLoading, refetch } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/staff/list`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.staff || [];
    },
  });

  const handleRevoke = async () => {
    if (!revokingMember) return;
    
    const memberId = revokingMember.memberId;
    const memberName = revokingMember.name;

    try {
      const res = await fetch(`${apiUrl}/api/workspaces/staff/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke access.");
      }

      toast.success(`${memberName}'s access has been revoked.`);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRevokingMember(null);
    }
  };

  const getRoleColor = (roleName: string) => {
    const normalized = roleName.toLowerCase();
    if (normalized === 'owner') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (normalized.includes('admin') || normalized.includes('manager')) return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
    return 'bg-muted/50 text-foreground border-border';
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground animate-pulse">Loading staff directory...</div>;
  }

  if (staff.length === 0) {
    return <div className="p-4 text-center text-muted-foreground border rounded-md">No staff members found.</div>;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Office Role</TableHead>
            <TableHead>Wallet Balance</TableHead>
            {!isReadOnly && <TableHead>Joined</TableHead>}
            {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member: StaffMember) => (
            <TableRow 
              key={member.memberId}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setViewingMember(member)}
            >
              <TableCell className="font-medium">
                <div>{member.name}</div>
                <div className="text-xs text-muted-foreground">{member.email}</div>
              </TableCell>
              <TableCell>
                <div className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium ${getRoleColor(member.roleName)}`}>
                  {member.roleName || "Member"}
                </div>
              </TableCell>
              <TableCell 
                className="font-medium text-green-600 dark:text-green-500 cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingWalletUser(member);
                }}
              >
                ${Number(member.walletBalance || 0).toFixed(2)}
              </TableCell>
              {!isReadOnly && (
                <TableCell className="text-muted-foreground">
                  {member.createdAt ? format(new Date(member.createdAt), "MMM d, yyyy") : "-"}
                </TableCell>
              )}
              
              {!isReadOnly && (
                <Can
                  I="role:manage" // Using role:manage for editing/revoking or staff:revoke
                  fallback={<TableCell />}
                >
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingMember(member)}>
                          Change Role
                        </DropdownMenuItem>
                        {!member.isSystem && (
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRevokingMember(member)}
                          >
                            Revoke Access
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </Can>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
            <DialogDescription>
              Detailed information for {viewingMember?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingMember && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold uppercase border border-primary/20">
                  {viewingMember.name?.charAt(0) || viewingMember.email?.charAt(0) || "?"}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewingMember.name}</h3>
                  <p className="text-sm text-muted-foreground">{viewingMember.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Office Role</p>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium w-fit ${getRoleColor(viewingMember.roleName)}`}>
                    {viewingMember.roleName || "Member"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Joined Workspace</p>
                  <p className="text-sm">
                    {viewingMember.createdAt ? format(new Date(viewingMember.createdAt), "MMMM d, yyyy") : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editingMember && (
        <EditStaffRoleModal
          isOpen={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          memberId={editingMember.memberId}
          memberName={editingMember.name}
          currentRoleId={editingMember.roleId}
          isSystemRole={editingMember.isSystem}
        />
      )}

      <AlertDialog open={!!revokingMember} onOpenChange={(open) => !open && setRevokingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently revoke access for{" "}
              <span className="font-semibold text-foreground">{revokingMember?.name}</span> and remove them from the office.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WalletHistoryModal 
        viewingUser={viewingWalletUser}
        onClose={() => setViewingWalletUser(null)}
      />
    </div>
  );
}
