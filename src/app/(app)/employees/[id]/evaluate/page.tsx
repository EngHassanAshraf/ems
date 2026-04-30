import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  getServerUser,
  isSuperAdmin,
  isSiteAdmin,
  isSiteSecurityManager,
} from "@/lib/auth/user";
import { listCriteria, getEvaluationById } from "@/actions/evaluations";
import { EvaluationForm } from "@/features/evaluations/evaluation-form";
import { EmployeeEvalCard } from "@/features/evaluations/employee-eval-card";

export default async function EvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evalId?: string }>;
}) {
  const { id } = await params;
  const { evalId } = await searchParams;

  const user = await getServerUser();
  const t = await getTranslations("evaluations");

  if (isSiteAdmin(user)) {
    redirect("/employees");
  }

  // Fetch employee with all display fields
  const employee = await (prisma as any).employee.findUnique({
    where: { id },
    include: {
      site:     { select: { nameAr: true } },
      jobTitle: { select: { nameAr: true } },
    },
  });

  if (!employee) notFound();

  let canEdit = isSuperAdmin(user)
    ? true
    : isSiteSecurityManager(user)
    ? employee.siteId === user.siteId
    : false;

  if (employee.status === "fired") canEdit = false;

  const criteriaResult = await listCriteria(true);
  const criteria = criteriaResult.success ? criteriaResult.data : [];

  let existingEvaluation = null;
  if (evalId) {
    const evalResult = await getEvaluationById(evalId);
    if (evalResult.success) existingEvaluation = evalResult.data;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Back link */}
      <Link
        href={`/employees/${id}`}
        className="inline-flex items-center gap-2 -ms-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
      >
        <ArrowRight className="h-4 w-4" />
        {t("backToEmployee")}
      </Link>

      {/* Employee identity card */}
      <EmployeeEvalCard
        nameAr={employee.nameAr}
        avatarUrl={employee.avatarUrl}
        employeeCode={employee.employeeCode}
        jobTitle={employee.jobTitle?.nameAr}
        site={employee.site?.nameAr}
        hireDate={employee.hireDate}
      />

      <EvaluationForm
        employee={{
          id: employee.id,
          nameAr: employee.nameAr,
          siteId: employee.siteId,
          site: employee.site,
        }}
        criteria={criteria}
        existingEvaluation={existingEvaluation}
        canEdit={canEdit}
      />
    </div>
  );
}
