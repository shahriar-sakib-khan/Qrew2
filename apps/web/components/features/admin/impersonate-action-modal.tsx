'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, UserCog } from 'lucide-react';
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
import { SecurityUserContext } from './security-action-modal';

interface ImpersonateActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SecurityUserContext | null;
}

export function ImpersonateActionModal({ isOpen, onClose, user }: ImpersonateActionModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal state changes
  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  const impersonateMutation = useMutation({
    mutationFn: async (auditReason: string) => {
      if (!user) throw new Error('Missing user context');

      const res = await fetch(`${apiUrl}/api/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id, reason: auditReason }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || 'Impersonation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Starting impersonation for ${user?.email}`);
      // Force hard browser refresh to wipe admin client cache and bootstrap as tenant
      window.location.href = '/dashboard';
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleImpersonate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reason.length < 10) {
      setError('Audit reason must be at least 10 characters.');
      return;
    }
    impersonateMutation.mutate(reason);
  };

  // Guard Clause: Prevent rendering errors if context is missing
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleImpersonate}>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserCog className="mr-2 h-5 w-5 text-indigo-500" />
              Impersonate User
            </DialogTitle>
            <DialogDescription>
              You are about to access the platform as <strong>{user.email}</strong>. 
              This action is strictly audited and recorded for SOC2 compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="impersonate-reason">
                SOC2 Audit Reason (Required)
              </Label>
              <Input
                id="impersonate-reason"
                placeholder="e.g., Zendesk Ticket #10492"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={impersonateMutation.isPending}
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={impersonateMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={impersonateMutation.isPending || reason.length < 10}>
              {impersonateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Impersonation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
