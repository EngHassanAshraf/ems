"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children, isSuperAdmin }: { children: React.ReactNode; isSuperAdmin: boolean }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:shrink-0">
          <Sidebar isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50">
              <Sidebar isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
  );
}
