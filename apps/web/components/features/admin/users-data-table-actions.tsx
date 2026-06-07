'use client';

import { MoreHorizontal, UserCog, Ban, ShieldAlert, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SecurityActionType, SecurityUserContext } from './security-action-modal';

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  admin: 2,
  super_admin: 3,
};

interface UsersDataTableActionsProps {
  user: SecurityUserContext;
  currentUserRole: string;
  onImpersonate: (user: SecurityUserContext) => void;
  onSecurityAction: (user: SecurityUserContext, action: SecurityActionType) => void;
}

export function UsersDataTableActions({ user, currentUserRole, onImpersonate, onSecurityAction }: UsersDataTableActionsProps) {
  const actorLevel = ROLE_HIERARCHY[currentUserRole] ?? 1;
  const targetLevel = ROLE_HIERARCHY[user.role] ?? 1;

  // If actor does not strictly outrank target (and is not super_admin acting on super_admin),
  // hide the dropdown completely and render a disabled placeholder.
  if (targetLevel >= actorLevel && actorLevel < 3) {
    return (
      <Button variant="ghost" className="h-8 w-8 p-0" disabled>
        <span className="sr-only">No actions available</span>
        <MoreHorizontal className="h-4 w-4 opacity-30" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        
        {/* Support Operations */}
        <DropdownMenuItem 
          onClick={() => onImpersonate(user)}
          className="cursor-pointer"
        >
          <UserCog className="mr-2 h-4 w-4" />
          Impersonate
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Security Operations */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Security</DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => onSecurityAction(user, 'require_reset')}
          className="cursor-pointer"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Force Password Reset
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onSecurityAction(user, 'suspend')}
          className="cursor-pointer text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950"
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          Suspend Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => onSecurityAction(user, 'ban')}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Ban className="mr-2 h-4 w-4" />
          Hard Ban User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
