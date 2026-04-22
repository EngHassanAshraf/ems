"use client";

import { useTranslations } from "next-intl";
import { Pencil, Trash2, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EmployeeStatusBadge } from "./employee-status-badge";
import type { Employee } from "@prisma/client";

type EmployeeWithSite = Employee & { site: { nameAr: string } | null; jobTitle: { nameAr: string } | null };

interface EmployeesTableProps {
  employees: EmployeeWithSite[];
  isSuperAdmin: boolean;
  onEdit: (e: EmployeeWithSite) => void;
  onDelete: (e: EmployeeWithSite) => void;
  onView: (e: EmployeeWithSite) => void;
}

export function EmployeesTable({ employees, isSuperAdmin, onEdit, onDelete, onView }: EmployeesTableProps) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title={t("noEmployees")}
        description={t("noEmployeesDesc")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="p-3 text-start font-medium">{t("nameAr")}</th>
            <th className="p-3 text-start font-medium hidden sm:table-cell">{t("jobTitle")}</th>
            {isSuperAdmin && <th className="p-3 text-start font-medium hidden lg:table-cell">{t("site")}</th>}
            <th className="p-3 text-start font-medium">{t("status")}</th>
            <th className="p-3 text-start font-medium">{tc("actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
              <td className="p-3 font-medium">{emp.nameAr}</td>
              <td className="p-3 text-muted-foreground hidden sm:table-cell">{emp.jobTitle?.nameAr ?? "—"}</td>
              {isSuperAdmin && <td className="p-3 text-muted-foreground hidden lg:table-cell">{emp.site?.nameAr ?? "—"}</td>}
              <td className="p-3">
                <EmployeeStatusBadge status={emp.status} />
              </td>
              <td className="p-3">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(emp)} title={tc("view")}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(emp)} title={tc("edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(emp)}
                    title={tc("delete")}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
