"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PasswordUpdateForm } from "./password-update-form";
import { ActiveSessionsTable } from "./active-sessions-table";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { TwoFactorCard } from "./two-factor-card";

export function SecurityView() {
  return (
    <div className="flex flex-col gap-8 text-foreground w-full min-w-0 pb-24">
      <div className="w-full min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your password, active sessions, and account security.</p>
      </div>

      {/* Password Management */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden min-w-0 w-full">
        <PasswordUpdateForm />
      </Card>

      {/* Two-Factor Authentication */}
      <TwoFactorCard />

      {/* Active Sessions */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden min-w-0 w-full">
        <CardHeader className="w-full min-w-0">
          <CardTitle className="font-medium text-lg">Active Sessions</CardTitle>
          <CardDescription className="truncate sm:whitespace-normal">Manage the devices currently logged into your account.</CardDescription>
        </CardHeader>
        <CardContent className="w-full min-w-0 overflow-hidden">
          <ActiveSessionsTable />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 bg-destructive/5 shadow-sm mt-4 overflow-hidden min-w-0 w-full">
        <CardHeader className="w-full min-w-0">
          <CardTitle className="font-medium text-lg text-destructive">Delete Account</CardTitle>
          <CardDescription className="w-full">Permanently remove your account and all associated data. This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col sm:flex-row gap-4 border-t border-destructive/20 bg-destructive/10 px-4 py-4 sm:px-6 justify-start sm:justify-between items-start sm:items-center w-full min-w-0">
          <p className="text-sm text-destructive font-medium">Proceed with caution.</p>
          <DeleteAccountDialog />
        </CardFooter>
      </Card>
    </div>
  );
}
