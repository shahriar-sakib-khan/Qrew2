import "./globals.css";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { ImpersonationBanner } from "@/components/features/auth/impersonation-banner";
import { ThemeProvider } from "@/components/features/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Qrew",
  description: "Enterprise SaaS Starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans dark", geist.variable)} suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ImpersonationBanner />
            {children}
            <Toaster position="bottom-right" richColors theme="system" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
