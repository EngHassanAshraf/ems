import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { EmployeeStatus } from "@prisma/client";

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const t = useTranslations("employees");
  const map = {
    active: { variant: "success" as const, label: t("statusActive") },
    fired: { variant: "destructive" as const, label: t("statusFired") },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
