"use client";

import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useDeleteAccount } from "@/hooks/use-delete-account";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function DeleteAccountDialog() {
  const { state, actions } = useDeleteAccount();

  return (
    <Dialog open={state.isOpen} onOpenChange={(open) => !open && actions.closeModal()}>
      <DialogTrigger asChild>
        <Button variant="destructive" onClick={actions.setIsOpen}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Account
        </Button>
      </DialogTrigger>

      {/* Zero Layout Shift Constraint: min-h-[350px] locks the height, flex-col orchestrates the internals */}
      <DialogContent className="w-[calc(100%-2rem)] max-w-md min-h-[350px] flex flex-col border-destructive/20 bg-background/95 backdrop-blur-xl">

        {/* Global Loading Overlay for API Actions */}
        {(state.isLoading || state.isDeleting) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-8 animate-spin text-destructive" />
              {state.isDeleting && <p className="text-sm font-medium animate-pulse text-destructive">Purging account footprint...</p>}
            </div>
          </div>
        )}

        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            This action cannot be undone. This will permanently delete your account,
            revoke all active sessions, and wipe your data from our servers.
          </DialogDescription>
        </DialogHeader>

        {/* --- STEP 1: WARNING --- */}
        {state.step === "warning" && (
          <div className="flex flex-col flex-1 mt-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mb-4">
              You are about to permanently delete <strong>{state.userEmail}</strong>.
              All associated projects, files, and billing histories will be immediately destroyed.
            </div>

            <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={actions.closeModal} disabled={state.isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={actions.handleInitiateDeletion} disabled={state.authType === null}>
                I understand, proceed
              </Button>
            </div>
          </div>
        )}

        {/* --- STEP 2A: CREDENTIAL VERIFICATION --- */}
        {state.step === "password-verify" && (
          <form onSubmit={actions.executeDeletion} className="flex flex-col flex-1 mt-4">
            <div className="space-y-4">
              <Label htmlFor="delete-password">Confirm your password</Label>
              <PasswordInput
                id="delete-password"
                placeholder="Enter your current password"
                value={state.password}
                onChange={(e) => actions.setPassword(e.target.value)}
                disabled={state.isDeleting}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={actions.closeModal} disabled={state.isDeleting}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!state.password || state.isDeleting}>
                Permanently Delete
              </Button>
            </div>
          </form>
        )}

        {/* --- STEP 2B: OAUTH EMAIL OTP VERIFICATION --- */}
        {state.step === "otp-verify" && (
          <form onSubmit={actions.executeDeletion} className="flex flex-col flex-1 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-otp">Enter the 6-digit confirmation code</Label>
                <p className="text-xs text-muted-foreground">We sent a security code to {state.userEmail}.</p>
              </div>
              <Input
                id="delete-otp"
                placeholder="000000"
                value={state.otp}
                onChange={(e) => actions.setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="text-center tracking-widest text-lg font-mono focus-visible:ring-destructive"
                disabled={state.isDeleting}
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={actions.closeModal} disabled={state.isDeleting}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={state.otp.length !== 6 || state.isDeleting}>
                Permanently Delete
              </Button>
            </div>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}
