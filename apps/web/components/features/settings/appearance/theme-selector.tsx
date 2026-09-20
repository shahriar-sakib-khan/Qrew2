"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession, authClient } from "@/lib/auth-client";

export function ThemeSelector() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-10 w-[240px] rounded-lg bg-muted animate-pulse" />;

  const syncThemeWithRetry = async (themeToSync: string, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error } = await authClient.updateUser({ theme: themeToSync });
        if (!error) return;

        console.warn(`Theme sync failed (Attempt ${attempt}/${maxRetries}):`, error);
      } catch (err) {
        console.warn(`Theme sync network error (Attempt ${attempt}/${maxRetries}):`, err);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    console.error("Theme sync permanently failed after multiple attempts.");
  };

  const handleThemeChange = (newTheme: string) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(newTheme);
      });
    } else {
      setTheme(newTheme);
    }

    if (session?.user && newTheme !== theme) {
      syncThemeWithRetry(newTheme);
    }
  };

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="relative w-full sm:w-auto grid grid-cols-3 sm:flex sm:items-center rounded-xl border border-border/50 bg-muted/20 p-1 backdrop-blur-sm">
      {options.map((option) => {
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            className={cn(
              "relative flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <option.icon className="h-4 w-4 shrink-0" />
            <span className="hidden min-[360px]:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
