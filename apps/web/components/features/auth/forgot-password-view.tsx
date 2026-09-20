"use client";

import { useState, useEffect } from "react";
import type { SubmitEvent } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrewLogo } from "@/components/ui/logo";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simplified UI Cooldown State
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const executePasswordReset = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cooldown > 0) return; // Failsafe against DOM manipulation

    setIsLoading(true);
    setError(null);

    const { error: authError } = await authClient.requestPasswordReset({ email });

    setIsLoading(false);

    if (authError) {
      setError(authError.message || "Failed to send reset link.");
    } else {
      setCooldown(30); // Start 30-second cooldown
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-2xl border-border/50 bg-background/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-emerald-500/10 p-4 rounded-full w-fit">
            <MailCheck className="h-8 w-8 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-base">
            We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setIsSubmitted(false)}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Try again in ${cooldown}s` : "Didn't receive it? Try again"}
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/sign-in"><ArrowLeft className="mr-2 h-4 w-4" /> Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-2xl border-border/50 bg-background/50 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="flex justify-center mb-2"><QrewLogo className="h-10 w-10" /></div>
        <CardTitle className="text-2xl font-bold tracking-tight">Forgot password?</CardTitle>
        <CardDescription>Enter your email to receive a secure reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={executePasswordReset} className="space-y-4">
          {error && <div className="p-3 text-sm bg-destructive/15 text-destructive rounded-md">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading || cooldown > 0} />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || cooldown > 0}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : cooldown > 0 ? `Wait ${cooldown}s` : "Send reset link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
