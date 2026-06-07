"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Users
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/constants";
import { useSession } from "@/lib/auth-client";
import { SecurityActionModal, SecurityActionType, SecurityUserContext } from "./security-action-modal";
import { UsersDataTableActions } from "./users-data-table-actions";
import { ImpersonateActionModal } from "./impersonate-action-modal";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  status: string;
  requiresPasswordReset: boolean;
  primaryWorkspace: string;
  additionalWorkspacesCount: number;
  allWorkspaces: { id: string; name: string }[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UsersApiResponse {
  data: UserRecord[];
  meta: PaginationMeta;
}

export function UsersDataTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: session } = useSession();
  const currentUserRole = (session?.user as any)?.role ?? "user";

  // 1. Parse URL State
  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const limit = 20;

  // Local state for instant input response
  const [searchInputValue, setSearchInputValue] = useState(search);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>(workspaceId);

  // Lifted UI State
  const [securityModal, setSecurityModal] = useState<{
    isOpen: boolean;
    user: SecurityUserContext | null;
    actionType: SecurityActionType | null;
  }>({ isOpen: false, user: null, actionType: null });

  const [impersonateModal, setImpersonateModal] = useState<{
    isOpen: boolean;
    user: SecurityUserContext | null;
  }>({ isOpen: false, user: null });

  // Callbacks passed to the columns/actions
  const handleSecurityAction = (user: SecurityUserContext, action: SecurityActionType) => {
    setSecurityModal({ isOpen: true, user, actionType: action });
  };

  const handleImpersonateAction = (user: SecurityUserContext) => {
    setImpersonateModal({ isOpen: true, user });
  };

  // Sync state if URL changes externally (e.g. browser back button)
  useEffect(() => {
    setSearchInputValue(search);
    setSelectedWorkspaceId(workspaceId);
  }, [search, workspaceId]);

  // 2. Debounce URL State Update
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);
      const prevSearch = currentParams.get("search") || "";
      if (searchInputValue !== prevSearch) {
        if (searchInputValue.trim()) {
          currentParams.set("search", searchInputValue.trim());
        } else {
          currentParams.delete("search");
        }
        currentParams.set("page", "1"); // Reset to page 1 on new search
        router.push(`${pathname}?${currentParams.toString()}`);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInputValue, pathname, router]);

  // 3. TanStack Query
  const { data, isLoading, isPlaceholderData } = useQuery<UsersApiResponse>({
    queryKey: ["admin-users", page, search, selectedWorkspaceId],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        queryParams.set("search", search);
      }
      if (selectedWorkspaceId) {
        queryParams.set("workspaceId", selectedWorkspaceId);
      }

      const res = await fetch(`${apiUrl}/api/admin/users?${queryParams.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch users");
      }

      return res.json();
    },
    placeholderData: (prev) => prev, // Keeps old data visible during transitions
    staleTime: 5000,
  });

  // Fetch workspaces for the filter dropdown
  const { data: workspacesData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["admin-workspaces"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/admin/workspaces`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json();
    },
  });
  const availableWorkspaces = workspacesData?.data || [];

  // Helper: Role-specific styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 uppercase text-[10px] tracking-wider" variant="outline">
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/10 uppercase text-[10px] tracking-wider" variant="outline">
            Admin
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted uppercase text-[10px] tracking-wider" variant="outline">
            User
          </Badge>
        );
    }
  };

  const handlePageChange = (newPage: number) => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set("page", newPage.toString());
    router.push(`${pathname}?${currentParams.toString()}`);
  };

  const usersList = data?.data || [];
  const meta = data?.meta;
  const total = meta?.total || 0;
  const totalPages = meta?.totalPages || 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="pl-9 bg-card/50"
            />
            {searchInputValue && searchInputValue !== search && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <Select
            value={selectedWorkspaceId || "all"}
            onValueChange={(val) => {
              const newId = val === "all" ? undefined : val;
              setSelectedWorkspaceId(newId);
              
              const currentParams = new URLSearchParams(window.location.search);
              if (newId) {
                currentParams.set("workspaceId", newId);
              } else {
                currentParams.delete("workspaceId");
              }
              currentParams.set("page", "1");
              router.push(`${pathname}?${currentParams.toString()}`);
            }}
          >
            <SelectTrigger className="w-[220px] bg-card/50">
              <SelectValue placeholder="Filter by Workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workspaces</SelectItem>
              {availableWorkspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Updating..." : `Total users: ${total}`}
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/10">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[220px]">Name</TableHead>
              <TableHead className="w-[250px]">Email</TableHead>
              <TableHead className="w-[200px]">Workspace(s)</TableHead>
              <TableHead className="w-[140px]">System Role</TableHead>
              <TableHead className="w-[150px]">Joined</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && usersList.length === 0 ? (
              // Skeletal Loading state
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell><div className="h-4 bg-muted/65 rounded w-32" /></TableCell>
                  <TableCell><div className="h-4 bg-muted/65 rounded w-48" /></TableCell>
                  <TableCell><div className="h-4 bg-muted/65 rounded w-40" /></TableCell>
                  <TableCell><div className="h-5 bg-muted/65 rounded w-20" /></TableCell>
                  <TableCell><div className="h-4 bg-muted/65 rounded w-24" /></TableCell>
                  <TableCell className="text-right"><div className="h-8 w-8 bg-muted/65 rounded ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : usersList.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 stroke-1 text-muted-foreground/60" />
                    <span>No users found. Try adjusting your search query.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Render Records
              usersList.map((user) => (
                <TableRow
                  key={user.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    isPlaceholderData ? "opacity-70" : ""
                  }`}
                >
                  <TableCell className="font-medium text-foreground">
                    {user.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{user.email}</span>
                      {user.emailVerified && (
                        <span className="text-[10px] text-green-500 font-normal">Verified</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.primaryWorkspace === 'No Workspace' ? (
                      <span className="text-sm text-muted-foreground italic">None</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{user.primaryWorkspace}</span>
                        {user.additionalWorkspacesCount > 0 && (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Badge variant="secondary" className="cursor-help text-[10px] h-5 px-1.5 hover:bg-secondary/80">
                                +{user.additionalWorkspacesCount} more
                              </Badge>
                            </HoverCardTrigger>
                            <HoverCardContent align="start" className="w-64 z-[110]">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold">All Workspaces</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {user.allWorkspaces?.map((ws: any) => (
                                    <li key={ws.id} className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                      {ws.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <UsersDataTableActions
                      user={{ id: user.id, email: user.email, role: user.role }}
                      currentUserRole={currentUserRole}
                      onImpersonate={handleImpersonateAction}
                      onSecurityAction={handleSecurityAction}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="gap-1 h-8"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="gap-1 h-8"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Shared Modals Mounted at the Root */}
      <SecurityActionModal 
        isOpen={securityModal.isOpen} 
        onClose={() => setSecurityModal((prev) => ({ ...prev, isOpen: false }))} 
        user={securityModal.user} 
        actionType={securityModal.actionType} 
      />

      {/* Phase 1 Impersonate Modal (Refactored to match this pattern) */}
      <ImpersonateActionModal
        isOpen={impersonateModal.isOpen}
        onClose={() => setImpersonateModal((prev) => ({ ...prev, isOpen: false }))}
        user={impersonateModal.user}
      />
    </div>
  );
}
