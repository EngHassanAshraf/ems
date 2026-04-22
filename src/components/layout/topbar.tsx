"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon, Monitor, Languages, Menu } from "lucide-react";
import { useTheme } from "@/lib/theme/provider";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const t = useTranslations("app");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleLocale = () => {
    const next = locale === "ar" ? "en" : "ar";
    // Replace locale segment in pathname
    const newPath = pathname.replace(/^\/(ar|en)/, `/${next}`);
    router.push(newPath as any);
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
      {/* Mobile menu */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Language toggle */}
        <Button variant="ghost" size="icon" onClick={toggleLocale} title={t("toggleLanguage")}>
          <Languages className="h-5 w-5" />
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={t("toggleTheme")}>
          {resolvedTheme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
}
