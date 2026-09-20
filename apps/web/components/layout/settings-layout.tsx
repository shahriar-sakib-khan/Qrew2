"use client";

import React from "react";
import { User, Shield, Palette, Building } from "lucide-react";
import { SidebarNavLink } from "@/components/layout/sidebar-nav-link";

export function SettingsLayout({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const tabs = [
    { name: "Profile", href: `${basePath}/settings/profile`, icon: User },
    { name: "Security", href: `${basePath}/settings/security`, icon: Shield },
    { name: "Appearance", href: `${basePath}/settings/appearance`, icon: Palette },
    { name: "Workspace", href: `${basePath}/settings/workspace`, icon: Building },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Horizontal Tab Navigation — uses the same SidebarNavLink component as the sidebar */}
      <nav className="flex items-center gap-1 border-b border-border/50 pb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <SidebarNavLink
            key={tab.name}
            href={tab.href}
            name={tab.name}
            icon={tab.icon}
            activeVariant="muted"
            isCollapsed={false}
            showTooltip={false}
            className="shrink-0 w-auto border-b-2 border-transparent rounded-b-none data-[active=true]:border-primary"
          />
        ))}
      </nav>

      {/* Settings Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
