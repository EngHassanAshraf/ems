"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  isSuperAdmin: boolean;
  isSiteSecurityManager?: boolean;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  avatarUrl?: string | null;
}

export function AppShell({ children, isSuperAdmin, isSiteSecurityManager = false, userId, userName, userRole, avatarUrl }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const sidebarProps = { isSuperAdmin, isSiteSecurityManager, userId, userName, userRole, avatarUrl };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex md:shrink-0">
        <Sidebar {...sidebarProps} />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar {...sidebarProps} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
