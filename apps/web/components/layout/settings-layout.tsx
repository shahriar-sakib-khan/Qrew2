"use client";

import React from "react";
import { User, Shield, Palette } from "lucide-react";
import { SidebarNavLink } from "@/components/ui/sidebar-nav-link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function SettingsLayout({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const navItems = [
    { name: "Public Profile", href: `${basePath}/settings/profile`, icon: User },
    { name: "Security", href: `${basePath}/settings/security`, icon: Shield },
    { name: "Appearance", href: `${basePath}/settings/appearance`, icon: Palette },
  ];

  return (
    <div className="flex flex-col md:flex-row text-foreground md:-mx-4 md:-mt-4 mb-0 lg:-mx-6 lg:-mt-6 min-w-0 w-full max-w-full overflow-x-hidden md:overflow-visible gap-6 md:gap-0">
      <aside className="w-full min-w-0 md:w-56 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-border/50 bg-background/95 backdrop-blur-md md:bg-card/10 z-30 sticky top-0 md:static">
        <div className="md:sticky md:top-0 md:h-[calc(100vh-4rem)] overflow-hidden">
          <ScrollArea className="w-full h-full">
            <nav className="flex flex-row md:flex-col gap-2 p-4 w-fit md:w-full">
              {navItems.map((item) => (
                <SidebarNavLink
                  key={item.name}
                  href={item.href}
                  name={item.name}
                  icon={item.icon}
                  activeVariant="muted"
                  hideLabelOnMobile={false}
                  className="w-auto shrink-0 whitespace-nowrap"
                />
              ))}
            </nav>
            <ScrollBar orientation="horizontal" className="md:hidden" />
          </ScrollArea>
        </div>
      </aside>
      <main className="flex-1 min-w-0 w-full max-w-5xl flex flex-col gap-8 px-4 py-6 md:p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
