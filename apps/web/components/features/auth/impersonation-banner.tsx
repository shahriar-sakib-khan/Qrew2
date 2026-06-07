'use client';

import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/constants';

export function ImpersonationBanner() {
  const { data: session } = useSession();
  const [isReverting, setIsReverting] = useState(false);

  // Guard Clause: Only render if the session explicitly contains the impersonator ID
  if (!session?.session?.impersonatedBy) return null;

  const handleExit = async () => {
    setIsReverting(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/stop-impersonation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: Allows receiving the teardown cookies
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to exit impersonation');
      }

      // Hard refresh to restore Admin context and clear tenant cache
      window.location.href = '/admin/users';
    } catch (error: any) {
      console.error('Failed to exit impersonation', error);
      toast.error(error.message || 'Could not exit impersonation. Try clearing your cookies.');
      setIsReverting(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full z-100 bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2 font-medium text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>SECURITY WARNING:</strong> You are actively impersonating {session.user.email}. All actions are audited.
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleExit}
        disabled={isReverting}
        className="h-8 font-bold cursor-pointer"
      >
        {isReverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Exit Impersonation
      </Button>
    </div>
  );
}
