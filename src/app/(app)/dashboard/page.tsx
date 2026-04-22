import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Users, UserCheck, UserX, ArrowLeft } from "lucide-react";
import { getEmployeeStats, listEmployees } from "@/actions/employees";
import { StatCard } from "@/features/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeStatusBadge } from "@/features/employees/employee-status-badge";
import Link from "next/link";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  const statsResult = await getEmployeeStats();
  const recentResult = await listEmployees({ page: 1, pageSize: 5 });

  const stats = statsResult.success ? statsResult.data : { total: 0, active: 0, fired: 0 };
  const recentEmployees = recentResult.success ? recentResult.data.items : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("welcome")}</h1>
      </div>

      <Suspense fallback={<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("totalEmployees")} value={stats.total} icon={<Users className="h-5 w-5" />} colorClass="bg-primary/10 text-primary" />
          <StatCard title={t("activeEmployees")} value={stats.active} icon={<UserCheck className="h-5 w-5" />} colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <StatCard title={t("firedEmployees")} value={stats.fired} icon={<UserX className="h-5 w-5" />} colorClass="bg-destructive/10 text-destructive" />
        </div>
      </Suspense>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t("recentEmployees")}</CardTitle>
          <Link href="/employees" className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-md text-primary hover:bg-accent hover:text-accent-foreground transition-colors">
            {t("viewAll")}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {recentEmployees.map((emp) => (
              <li key={emp.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                <Link href={`/employees/${emp.id}`} className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{emp.nameAr}</p>
                    {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                  </div>
                  <EmployeeStatusBadge status={emp.status} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
