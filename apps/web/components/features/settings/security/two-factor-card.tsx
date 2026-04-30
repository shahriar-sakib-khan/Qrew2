"use client";

import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldAlert, Loader2, Copy, Check, Lock, Smartphone, Mail, ArrowLeft } from "lucide-react";
import { useTwoFactor } from "@/hooks/use-two-factor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function TwoFactorCard({ theme = "default" }: { theme?: "default" | "destructive" }) {
  const { state, actions } = useTwoFactor();

  const iconThemeClass = theme === "destructive" ? "text-destructive" : "text-primary";
  const buttonThemeClass = theme === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "";

  return (
    <>
      <Card className="backdrop-blur-sm shadow-sm overflow-hidden min-w-0 w-full">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 w-full min-w-0">
          <div className={`p-3 rounded-full shrink-0 ${theme === "destructive" ? "bg-destructive/10" : "bg-primary/10"}`}>
            {state.isEnabled ? <ShieldCheck className={`size-6 ${iconThemeClass}`} /> : <ShieldAlert className="size-6 text-muted-foreground" />}
          </div>
          <div>
            <CardTitle className="font-medium text-lg">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {state.isEnabled ? "Your account is secured with 2FA." : "Add an extra layer of security to your account."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="w-full min-w-0 pb-6">
          {!state.isEnabled && state.hasPassword === false && (
            <div className="space-y-4">
              <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive flex gap-2 items-start font-medium">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <p>You must set a local password in the section above before you can enable Two-Factor Authentication.</p>
              </div>
              <Button disabled className={buttonThemeClass}>Set Up 2FA</Button>
            </div>
          )}

          {!state.isEnabled && state.hasPassword === true && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground max-w-2xl">
                Two-factor authentication protects your account by requiring an additional code when you log in on an unrecognized device.
              </p>
              <Button onClick={actions.openModal} className={buttonThemeClass}>
                Set Up 2FA
              </Button>
            </div>
          )}

          {state.isEnabled && state.backupCodes.length > 0 && (
            <div className="space-y-4 border rounded-md p-4 bg-muted/30">
              <div>
                <h4 className="text-sm font-medium">Backup Codes</h4>
                <p className="text-xs text-muted-foreground mt-1">Save these codes in a secure place. They can be used to recover your account if you lose your device.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-xs font-mono text-sm">
                {state.backupCodes.map((code, idx) => (
                  <div key={idx} className="bg-background border px-2 py-1 rounded text-center">{code}</div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => actions.copyToClipboard(state.backupCodes.join("\n"), "codes")}>
                {state.copiedCodes ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {state.copiedCodes ? "Copied" : "Copy Codes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={state.isModalOpen} onOpenChange={(open) => !open && actions.closeModal()}>
        {/* Architectural Fix (Zero Layout Shift):
          min-h-[450px] locks the modal height. The inner flex-col handles the alignment.
          This prevents the modal from radically shrinking when moving from the QR code back to the password step.
        */}
        <DialogContent className="w-[calc(100%-2rem)] max-w-md min-h-[450px] flex flex-col">
          
          {/* Overlay loading spinner to prevent UI freezing during API calls */}
          {state.isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}

          {state.step === "password" && (
            <div className="flex flex-col flex-1">
              <DialogHeader>
                <DialogTitle>Verify your identity</DialogTitle>
                <DialogDescription>Please enter your current password to continue.</DialogDescription>
              </DialogHeader>
              <form onSubmit={actions.handlePasswordSubmit} className="flex flex-col flex-1 pt-4">
                <div className="flex-1">
                  <PasswordInput
                    placeholder="Current password"
                    value={state.currentPassword}
                    onChange={(e) => actions.setCurrentPassword(e.target.value)}
                    disabled={state.isLoading}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-auto pt-6">
                  <Button type="button" variant="ghost" onClick={actions.closeModal}>Cancel</Button>
                  <Button type="submit" disabled={state.isLoading || !state.currentPassword} className={buttonThemeClass}>
                    Continue
                  </Button>
                </div>
              </form>
            </div>
          )}

          {state.step === "method" && (
            <div className="flex flex-col flex-1">
              <DialogHeader>
                <DialogTitle>Choose 2FA Method</DialogTitle>
                <DialogDescription>Select how you want to receive your security codes.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-4 flex-1">
                <button
                  onClick={() => actions.handleSelectMethod("authenticator")}
                  disabled={state.isLoading}
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 transition-all text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <Smartphone className="size-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Authenticator App (Recommended)</h4>
                    <p className="text-xs text-muted-foreground mt-1">Use an app like Google Authenticator or Authy to generate codes offline.</p>
                  </div>
                </button>

                <button
                  onClick={() => actions.handleSelectMethod("email")}
                  disabled={state.isLoading}
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 transition-all text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <Mail className="size-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Email Address</h4>
                    <p className="text-xs text-muted-foreground mt-1">Receive a 6-digit verification code directly to your inbox.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {state.step === "qr" && (
            <div className="flex flex-col flex-1 relative">
              <div className="absolute top-0 left-0">
                <Button variant="ghost" size="sm" onClick={() => actions.setStep("method")} className="h-8 px-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>
              <DialogHeader>
                <DialogTitle>Scan QR Code</DialogTitle>
                <DialogDescription>Open your preferred TOTP app and scan this code.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center pt-4 flex-1">
                <div className="p-4 bg-white rounded-xl shadow-sm border mb-4">
                  <QRCodeSVG value={state.qrCodeData} size={160} level="H" includeMargin={true} />
                </div>

                <div className="w-full text-center space-y-1 mb-6">
                  <p className="text-xs text-muted-foreground">Can't scan the code? Use this manual entry key:</p>
                  <button onClick={() => actions.copyToClipboard(actions.extractSecretFromURI(state.qrCodeData), "key")} className="text-xs font-mono bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors inline-flex items-center gap-2">
                    {actions.extractSecretFromURI(state.qrCodeData)}
                    {state.copiedKey ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  </button>
                </div>

                <div className="w-full space-y-2 mt-auto">
                  <Label htmlFor="otpCode">Enter the 6-digit code</Label>
                  <Input
                    id="otpCode"
                    placeholder="000000"
                    value={state.otpCode}
                    onChange={(e) => actions.setOtpCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="text-center tracking-widest text-lg font-mono"
                    disabled={state.isLoading}
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="flex w-full justify-end gap-2 mt-6">
                  <Button type="button" variant="ghost" onClick={actions.closeModal}>Cancel</Button>
                  <Button type="button" onClick={actions.verifyAndEnable} disabled={state.isLoading || state.otpCode.length !== 6} className={buttonThemeClass}>
                    Verify & Enable
                  </Button>
                </div>
              </div>
            </div>
          )}

          {state.step === "email" && (
            <div className="flex flex-col flex-1 relative">
              <div className="absolute top-0 left-0">
                <Button variant="ghost" size="sm" onClick={() => actions.setStep("method")} className="h-8 px-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>
              <DialogHeader>
                <DialogTitle>Verify Email</DialogTitle>
                <DialogDescription>We just sent a 6-digit code to your email address. Enter it below to enable 2FA.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center pt-4 flex-1">
                <div className="w-full space-y-2 mt-6">
                  <Label htmlFor="emailOtpCode">Enter the 6-digit code</Label>
                  <Input
                    id="emailOtpCode"
                    placeholder="000000"
                    value={state.otpCode}
                    onChange={(e) => actions.setOtpCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="text-center tracking-widest text-lg font-mono"
                    disabled={state.isLoading}
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="flex w-full justify-between items-center gap-2 mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() => actions.handleSelectMethod("email")}
                    disabled={state.isLoading}
                    className="text-xs text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-1 rounded"
                  >
                    Resend code
                  </button>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={actions.closeModal}>Cancel</Button>
                    <Button type="button" onClick={actions.verifyAndEnable} disabled={state.isLoading || state.otpCode.length !== 6} className={buttonThemeClass}>
                      Verify & Enable
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
