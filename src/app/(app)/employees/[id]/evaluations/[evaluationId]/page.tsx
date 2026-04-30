import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSiteAdmin, isSuperAdmin, isSiteSecurityManager } from "@/lib/auth/user";
import { getEvaluationById } from "@/actions/evaluations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Grade variant is based on the English DB value — translation is separate
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

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ id: string; evaluationId: string }>;
}) {
  const { id, evaluationId } = await params;
  const t = await getTranslations("evaluations");

  const user = await getServerUser();

  // site_admin has no access — redirect to employees list
  if (isSiteAdmin(user)) {
    redirect("/employees");
  }

  // Fetch evaluation (RBAC enforced inside the action)
  const result = await getEvaluationById(evaluationId);

  // Score label map using translation keys
  const scoreLabels: Record<string, string> = {
    EXCELLENT: t("scoreExcellent"),
    VERY_GOOD: t("scoreVeryGood"),
    GOOD: t("scoreGood"),
    ACCEPTABLE: t("scoreAcceptable"),
  };

  // Grade label map using translation keys (DB stores English, display uses locale)
  const gradeLabels: Record<string, string> = {
    Excellent: t("gradeExcellent"),
    "Very Good": t("gradeVeryGood"),
    Good: t("gradeGood"),
    Acceptable: t("gradeAcceptable"),
  };

  // If forbidden (site_security_manager accessing another site's evaluation), show 403
  if (!result.success) {
    if (result.error === "errors.forbidden") {
      return (
        <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] space-y-4">
          <h1 className="text-4xl font-bold text-destructive">403</h1>
          <p className="text-lg text-muted-foreground">{t("forbiddenMessage")}</p>
          <Link
            href="/employees"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
          >
            <ArrowRight className="h-4 w-4" />
            {t("backToEmployees")}
          </Link>
        </div>
      );
    }

    // Not found or other error
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-lg text-muted-foreground">{t("notFoundMessage")}</p>
        <Link
          href={`/employees/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
        >
          <ArrowRight className="h-4 w-4" />
          {t("backToEmployee")}
        </Link>
      </div>
    );
  }

  const evaluation = result.data;

  // Fetch employee with site for display names
  const employee = await (prisma as any).employee.findUnique({
    where: { id: evaluation.employeeId },
    include: {
      site: { select: { nameAr: true } },
    },
  });

  // Compute canEdit — same rules as the evaluate page
  const canEdit = isSuperAdmin(user)
    ? true
    : isSiteSecurityManager(user)
    ? evaluation.siteId === user.siteId
    : false;

  // Compute score visualisation values
  const itemCount = evaluation.items.length;
  const totalWeightedSum = evaluation.totalScore;
  const averageScore =
    itemCount > 0 ? Math.round((totalWeightedSum / itemCount) * 100) / 100 : 0;
  const finalGradeDisplay = evaluation.finalGrade
    ? (gradeLabels[evaluation.finalGrade] ?? evaluation.finalGrade)
    : "—";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header row: back link + edit button */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/employees/${id}`}
          className="inline-flex items-center gap-2 -ms-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
        >
          <ArrowRight className="h-4 w-4" />
          {t("backToEmployee")}
        </Link>

        {canEdit && (
          <Link
            href={`/employees/${id}/evaluate?evalId=${evaluationId}`}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="h-4 w-4" />
            {t("editEvaluation")}
          </Link>
        )}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("summaryCard")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">{t("employee")}</dt>
              <dd className="text-sm font-medium">{employee?.nameAr ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">{t("site")}</dt>
              <dd className="text-sm font-medium">{employee?.site?.nameAr ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">{t("finalScore")}</dt>
              <dd className="text-sm font-medium">{averageScore.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">{t("finalGrade")}</dt>
              <dd className="text-sm font-medium">
                <Badge variant={gradeVariant(evaluation.finalGrade)}>
                  {finalGradeDisplay}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("breakdownCard")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    {t("criterion")}
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    {t("score")}
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    {t("notes")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {evaluation.items.map((item, index) => {
                  const scoreLabel = scoreLabels[item.score] ?? item.score;
                  // gradeVariant still uses English score label for colour mapping
                  const scoreEnglish: Record<string, string> = {
                    EXCELLENT: "Excellent",
                    VERY_GOOD: "Very Good",
                    GOOD: "Good",
                    ACCEPTABLE: "Acceptable",
                  };
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 font-medium">{index+1}. {item.criteria.titleAr}</td>
                      <td className="px-6 py-3">
                        <Badge variant={gradeVariant(scoreEnglish[item.score] ?? null)}>
                          {scoreLabel}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {item.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {evaluation.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                      {t("noItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Score Visualisation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("visualisationCard")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">
                {t("totalWeightedSum")}
              </dt>
              <dd className="text-2xl font-bold">{totalWeightedSum}</dd>
              <dd className="text-xs text-muted-foreground mt-0.5">
                {t("acrossCount", { count: itemCount })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">
                {t("averageScore")}
              </dt>
              <dd className="text-2xl font-bold">{averageScore.toFixed(2)}</dd>
              <dd className="text-xs text-muted-foreground mt-0.5">
                {totalWeightedSum} ÷ {itemCount} = {averageScore.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">
                {t("finalGrade")}
              </dt>
              <dd className="text-2xl font-bold">
                <Badge variant={gradeVariant(evaluation.finalGrade)} className="text-base px-3 py-1">
                  {finalGradeDisplay}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
