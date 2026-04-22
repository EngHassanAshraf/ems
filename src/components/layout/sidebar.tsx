"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard, Users, FileText, LogOut,
  ChevronRight, Building2, MapPin, UserCog, Briefcase, BarChart3, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/actions/auth";

interface NavItem {
  key: string;
  label: "dashboard" | "employees" | "documents" | "sites" | "users" | "jobTitles" | "reports";
  href: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isSuperAdmin: boolean;
  userName?: string | null;
  userRole?: string | null;
  avatarUrl?: string | null;
}

export function Sidebar({ isSuperAdmin, userName, userRole, avatarUrl }: SidebarProps) {
  const t = useTranslations("app");
  const tu = useTranslations("users");
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { key: "dashboard", label: "dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { key: "employees", label: "employees", href: "/employees", icon: <Users className="h-5 w-5" /> },
    { key: "reports", label: "reports", href: "/reports", icon: <BarChart3 className="h-5 w-5" /> },
    ...(isSuperAdmin ? [
      { key: "sites", label: "sites" as const, href: "/sites", icon: <MapPin className="h-5 w-5" /> },
      { key: "users", label: "users" as const, href: "/users", icon: <UserCog className="h-5 w-5" /> },
      { key: "jobTitles", label: "jobTitles" as const, href: "/job-titles", icon: <Briefcase className="h-5 w-5" /> },
    ] : []),
    { key: "documents", label: "documents", href: "/documents", icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col border-e bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">{t("name")}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {item.icon}
              {t(item.label)}
              {active && <ChevronRight className="ms-auto h-4 w-4 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="border-t p-3 space-y-1">
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName ?? ""}
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <UserCircle className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName ?? "—"}</p>
            {userRole && (
              <p className="text-xs text-muted-foreground truncate">
                {tu(userRole as any)}
              </p>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
