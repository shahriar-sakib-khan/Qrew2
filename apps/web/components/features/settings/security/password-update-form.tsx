"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { authClient, useSession } from "@/lib/auth-client";

export function PasswordUpdateForm({ theme = "default" }: { theme?: "default" | "destructive" }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const { data: session } = useSession();

  // Friction State for Logged-In Password Reset
  const [resetAttempts, setResetAttempts] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Cooldown Timer
  useEffect(() => {
    if (resetCooldown > 0) {
      const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetCooldown]);

  const handleResetRequest = () => {
    if (resetAttempts >= 5) {
      toast.error("Maximum attempts reached. Please wait 60 seconds.");
      return;
    }
    setShowResetModal(true);
  };

  const executePasswordReset = async () => {
    setShowResetModal(false);
    setIsResetting(true);

    const email = session?.user?.email;

    if (!email) {
      toast.error("Could not determine user email.");
      setIsResetting(false);
      return;
    }

    const { error } = await authClient.requestPasswordReset({ email });

    setIsResetting(false);

    if (error) {
      toast.error(error.message || "Failed to send reset link.");
    } else {
      setResetAttempts((prev) => prev + 1);
      setResetCooldown(60); // Start 60s cooldown
      toast.success("Password reset link sent to your email!");
    }
  };

  useEffect(() => {
    async function checkAccounts() {
      const { data } = await authClient.listAccounts();
      if (data) {
        setHasPassword(data.some((account) => account.providerId === "credential"));
      } else {
        setHasPassword(false);
      }
    }
    checkAccounts();
  }, []);

  const passwordSchema = useMemo(() => {
    return z
      .object({
        currentPassword: hasPassword
          ? z.string().min(1, "Current password is required.")
          : z.string().optional(),
        newPassword: z.string().min(8, "Password must be at least 8 characters."),
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
  }, [hasPassword]);

  type PasswordValues = z.infer<typeof passwordSchema>;

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema as any),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onPasswordSubmit = async (data: PasswordValues) => {
    let error;
    const toastId = toast.loading("Updating security settings...");

    if (hasPassword) {
      const res = await authClient.changePassword({
        newPassword: data.newPassword,
        currentPassword: data.currentPassword || "",
        revokeOtherSessions: true,
      });
      error = res.error;
    } else {
      const clientAny = authClient as any;
      const res = await (clientAny.setPassword
        ? clientAny.setPassword({
            newPassword: data.newPassword,
          })
        : authClient.changePassword({
            newPassword: data.newPassword,
            currentPassword: "",
          }));
      error = res.error;
    }

    if (error) {
      toast.error(error.message || "Failed to update password.", { id: toastId });
    } else {
      toast.success(hasPassword ? "Password changed successfully." : "Password set successfully.", {
        id: toastId,
      });
      setHasPassword(true);
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  };

  const focusClass =
    theme === "destructive"
      ? "focus-visible:ring-destructive border-destructive"
      : "focus-visible:ring-primary border-primary";

  const isLoading = hasPassword === null;
  const isSubmitting = passwordForm.formState.isSubmitting;

  return (
    <div className="relative flex flex-col w-full min-w-0">
      {/*
        The Absolute Overlay Pattern
        This replaces the conditional unmounting of the form, eliminating Cumulative Layout Shift (CLS).
      */}
      {(isLoading || isSubmitting) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50 backdrop-blur-sm rounded-xl">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <CardHeader className="px-4 sm:px-6 pt-5 pb-0">
        <CardTitle className="font-medium text-lg">Password</CardTitle>
        <CardDescription>
          Update your password or set one if you signed up with a social provider.
        </CardDescription>
      </CardHeader>
      <form
        id="password-form"
        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
        className="flex flex-col w-full min-w-0"
      >
        <CardContent className="pt-4 pb-6 w-full min-w-0">
          {/* Swapped space-y-6 for gap-4 to tighten the vertical rhythm */}
          <div className="flex flex-col gap-4 w-full min-w-0 max-w-md">
            {/*
              By checking `!== false`, we render this field during the `null` loading state.
              This ensures the form takes up its maximum height initially, preventing a vertical jump
              when it resolves to true.
            */}
            {hasPassword !== false && (
              <div className="flex flex-col gap-4">
                <Controller
                  name="currentPassword"
                  control={passwordForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <div className="flex items-center justify-between mb-1">
                        <FieldLabel htmlFor={field.name}>Current Password</FieldLabel>
                        <button
                          type="button"
                          onClick={handleResetRequest}
                          disabled={isResetting || resetCooldown > 0}
                          className={`text-xs font-medium hover:underline disabled:opacity-50 disabled:no-underline focus-visible:outline-none focus-visible:ring-1 rounded ${theme === "destructive" ? "text-destructive focus-visible:ring-destructive" : "text-primary focus-visible:ring-primary"}`}
                        >
                          {isResetting ? (
                            <span className="flex items-center">
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Sending...
                            </span>
                          ) : resetCooldown > 0 ? (
                            `Wait ${resetCooldown}s`
                          ) : (
                            "Forgot password?"
                          )}
                        </button>
                      </div>
                      <PasswordInput
                        {...field}
                        id={field.name}
                        placeholder="Enter your current password"
                        aria-invalid={fieldState.invalid}
                        disabled={isLoading || isSubmitting}
                        className={fieldState.isDirty ? focusClass : ""}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                {/* Reduced separator margin */}
                <Separator className="my-1" />
              </div>
            )}

            {hasPassword === false && (
              <div className="p-3 mb-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground leading-relaxed">
                You signed in using a social account. Set a password here if you also want to log in
                using your email.
              </div>
            )}

            <Controller
              name="newPassword"
              control={passwordForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="mb-1">
                    New Password
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    placeholder="Enter a new password"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading || isSubmitting}
                    className={fieldState.isDirty ? focusClass : ""}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="confirmPassword"
              control={passwordForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="mb-1">
                    Confirm New Password
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    placeholder="Confirm your new password"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading || isSubmitting}
                    className={fieldState.isDirty ? focusClass : ""}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </CardContent>

        {/* Tighter padding on the footer */}
        <CardFooter className="border-t border-border/50 bg-muted/30 px-4 sm:px-6 py-3 justify-end w-full min-w-0">
          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            className={`w-full sm:w-auto ${theme === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasPassword !== false ? "Update Password" : "Set Password"}
          </Button>
        </CardFooter>
      </form>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Confirm Action
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to request a password reset? You have used {resetAttempts} of 5
              attempts this minute.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowResetModal(false)} disabled={isResetting}>
              Cancel
            </Button>
            <Button onClick={executePasswordReset} disabled={isResetting}>
              Yes, send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
