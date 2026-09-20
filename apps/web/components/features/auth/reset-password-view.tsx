"use client";

import { useState, Suspense } from "react";
import type { SubmitEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrewLogo } from "@/components/ui/logo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      setError("Invalid or missing reset token. Please request a new link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: authError } = await authClient.resetPassword({
      newPassword: password,
      token: token,
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message || "Failed to reset password. The link may have expired.");
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/sign-in");
      }, 3000);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-2xl border-emerald-500/20 bg-background/50 backdrop-blur-xl">
        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
          <div className="bg-emerald-500/10 p-3 rounded-full">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <CardTitle className="text-xl">Password Reset Complete</CardTitle>
          <CardDescription>Your password has been successfully updated. Redirecting to login...</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-2xl border-border/50 bg-background/50 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="flex justify-center mb-2">
          <QrewLogo className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Set new password</CardTitle>
        <CardDescription>Please enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 text-sm bg-destructive/15 text-destructive border border-destructive/20 rounded-md">{error}</div>}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput
                id="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <Button type="submit" className="w-full mt-6" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordView() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin size-8 text-primary" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
