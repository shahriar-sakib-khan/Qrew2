'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldAlert, Ban, RefreshCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/constants';

export type SecurityActionType = 'ban' | 'suspend' | 'require_reset';

export interface SecurityUserContext {
  id: string;
  email: string;
  role: string;
}

interface SecurityActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SecurityUserContext | null;
  actionType: SecurityActionType | null;
}

export function SecurityActionModal({ isOpen, onClose, user, actionType }: SecurityActionModalProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Reset reason when modal opens/closes
  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  const config = {
    ban: {
      title: 'Hard Ban User',
      icon: <Ban className="mr-2 h-4 w-4 text-destructive" />,
      description: 'Permanently ban this user. All active sessions will be immediately terminated.',
      buttonText: 'Enforce Ban',
      variant: 'destructive' as const,
    },
    suspend: {
      title: 'Suspend Account',
      icon: <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" />,
      description: 'Temporarily lock this user out of their account. Active sessions will be terminated.',
      buttonText: 'Suspend User',
      variant: 'default' as const,
    },
    require_reset: {
      title: 'Force Password Reset',
      icon: <RefreshCcw className="mr-2 h-4 w-4" />,
      description: 'Force this user to reset their password on their next login. Active sessions will be terminated.',
      buttonText: 'Force Reset',
      variant: 'default' as const,
    },
  };

  const securityMutation = useMutation({
    mutationFn: async (auditReason: string) => {
      if (!user || !actionType) throw new Error('Missing user or action context');
      
      const res = await fetch(`${apiUrl}/api/admin/security-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id, action: actionType, reason: auditReason }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Security action failed');
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate cache to trigger an immediate background refetch of the table data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`Security action applied to ${user?.email}`);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleEnforce = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 10) {
      toast.error('Audit reason must be at least 10 characters.');
      return;
    }
    securityMutation.mutate(reason);
  };

  // Guard Clause: Prevent rendering errors if context is missing
  if (!user || !actionType) return null;

  const currentConfig = config[actionType];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleEnforce}>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {currentConfig.title}
            </DialogTitle>
            <DialogDescription>
              {currentConfig.description} 
              <br/><br/>
              Target: <strong className="text-foreground">{user.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="audit-reason">
                SOC2 Audit Reason (Required)
              </Label>
              <Input
                id="audit-reason"
                placeholder="e.g., Zendesk #10492 - Credential Stuffing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={securityMutation.isPending}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={securityMutation.isPending}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant={currentConfig.variant}
              disabled={securityMutation.isPending || reason.length < 10}
            >
              {securityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!securityMutation.isPending && currentConfig.icon}
              {currentConfig.buttonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
