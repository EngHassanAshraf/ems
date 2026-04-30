import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ArrowLeft, ClipboardList, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmployeeStatusBadge } from "@/features/employees/employee-status-badge";
import { EmployeeAvatar } from "@/features/employees/employee-avatar";
import { DocumentsList } from "@/features/documents/documents-list";
import { getServerUser, isSiteAdmin, isSiteSecurityManager, isSuperAdmin } from "@/lib/auth/user";
import { getEmployeeEvaluations } from "@/actions/evaluations";
import { listSites } from "@/actions/sites";
import { EditEmployeeButton } from "@/features/employees/edit-employee-button";

function gradeVariant(grade: string | null): "success" | "default" | "warning" | "destructive" {
  switch (grade) {
    case "Excellent":
      return "success";
    case "Very Good":
      return "default";
    case "Good":
      return "warning";
    case "Acceptable":
      return "destructive";
    default:
      return "default";
  }
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("employees");
  const td = await getTranslations("documents");
  const te = await getTranslations("evaluations");

  const [employee, user, sitesResult] = await Promise.all([
    (prisma as any).employee.findUnique({
      where: { id },
      include: {
        documents: true,
        site: { select: { nameAr: true } },
        jobTitle: { select: { nameAr: true } },
      },
    }),
    getServerUser(),
    listSites(true),
  ]);

  if (!employee) notFound();

  const siteAdmin = isSiteAdmin(user);
  const superAdmin = isSuperAdmin(user);
  const  siteSecurityManager = isSiteSecurityManager(user);
  const canEditEmployee = superAdmin || siteSecurityManager;
  const sites = sitesResult.success ? sitesResult.data : [];

  // Fetch evaluations history (only for non-site_admin users)
  const evaluationsResult = siteAdmin ? null : await getEmployeeEvaluations(id);
  const evaluations = evaluationsResult?.success ? evaluationsResult.data : [];

  const fields = [
    { label: t("nameAr"), value: employee.nameAr },
    { label: t("employeeCode"), value: employee.employeeCode },
    { label: t("jobTitle"), value: employee.jobTitle?.nameAr ?? null },
    { label: t("site"), value: employee.site?.nameAr ?? null },
    { label: t("email"), value: employee.email },
    { label: t("phone"), value: employee.phone },
    { label: t("address"), value: employee.address },
    { label: t("hireDate"), value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString("ar-EG") : null },
    ...(employee.status === "fired" && employee.firedReason
      ? [{ label: t("firedReason"), value: employee.firedReason }]
      : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <Link href="/employees" className="inline-flex items-center gap-2 -ms-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent">
        <ArrowRight className="h-4 w-4" />
        {t("backToList")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <EmployeeAvatar
            storagePath={employee.avatarUrl}
            name={employee.nameAr}
            className="h-16 w-16 rounded-full object-cover shrink-0 border"
            fallbackClassName="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0 border"
            fallbackIconClassName="h-9 w-9 text-muted-foreground"
          />
          <div>
            <h1 className="text-2xl font-semibold">{employee.nameAr}</h1>
            <div className="mt-2"><EmployeeStatusBadge status={employee.status} /></div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEditEmployee && (
            <EditEmployeeButton
              employee={employee}
              sites={sites}
              isSuperAdmin={superAdmin}
              userSiteId={user.siteId}
            />
          )}
          {!siteAdmin && employee.status != "fired" && (
            <Link
              href={`/employees/${id}/evaluate`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardList className="h-4 w-4" />
              {te("evaluate")}
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("personalInfo")}</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
                <dd className="text-sm font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{td("title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DocumentsList employeeId={id} companyId="" documents={employee.documents} isLoading={false} />
        </CardContent>
      </Card>

      {!siteAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{te("evaluationsHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {evaluations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                {te("noEvaluations")}
              </div>
            ) : (
              <ul className="divide-y">
                {evaluations.map((evaluation) => {
                  const date = new Date(evaluation.createdAt).toLocaleDateString("ar-EG");
                  const averageScore =
                    typeof evaluation.totalScore === "number"
                      ? evaluation.totalScore
                      : null;
                  const gradeLabels: Record<string, string> = {
                    Excellent: te("gradeExcellent"),
                    "Very Good": te("gradeVeryGood"),
                    Good: te("gradeGood"),
                    Acceptable: te("gradeAcceptable"),
                  };
                  return (
                    <li key={evaluation.id} className="flex items-center">
                      {/* Clickable area → result page */}
                      <Link
                        href={`/employees/${id}/evaluations/${evaluation.id}`}
                        className="flex flex-1 items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{date}</span>
                          {averageScore !== null && (
                            <span className="text-xs text-muted-foreground">
                              {te("totalScore")}: {averageScore}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {evaluation.finalGrade && (
                            <Badge variant={gradeVariant(evaluation.finalGrade)}>
                              {gradeLabels[evaluation.finalGrade] ?? evaluation.finalGrade}
                            </Badge>
                          )}
                          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>

                      {/* Edit button → evaluate page pre-loaded with this eval */}
                      <Link
                        href={`/employees/${id}/evaluate?evalId=${evaluation.id}`}
                        title={te("editEvaluation")}
                        className="shrink-0 mx-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
