"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, ClipboardList, Users, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { EvaluationForm } from "@/features/evaluations/evaluation-form";
import { EmployeeEvalCard } from "@/features/evaluations/employee-eval-card";
import type { EvaluationCriteria } from "@prisma/client";
import type { EvaluationWithItems } from "@/actions/evaluations";

type EmployeeItem = {
  id: string;
  nameAr: string;
  employeeCode: string | null;
  status: string;
  siteId: string | null;
  avatarUrl: string | null;
  hireDate: Date | string | null;
  site:     { nameAr: string } | null;
  jobTitle: { nameAr: string } | null;
};

interface EvaluationsClientProps {
  employees: EmployeeItem[];
  selectedEmployeeId: string | null;
  criteria: EvaluationCriteria[];
  existingEvaluation: EvaluationWithItems | null;
  canEdit: boolean;
}

// Grade colour — matches the DB English values
function gradeVariant(grade: string | null): "success" | "default" | "warning" | "destructive" {
  switch (grade) {
    case "Excellent": return "success";
    case "Very Good": return "default";
    case "Good":      return "warning";
    case "Acceptable": return "destructive";
    default:          return "default";
  }
}

// Score colour — maps enum to English grade for colour lookup
const SCORE_TO_GRADE: Record<string, string> = {
  EXCELLENT: "Excellent",
  VERY_GOOD: "Very Good",
  GOOD: "Good",
  ACCEPTABLE: "Acceptable",
};

export function EvaluationsClient({
  employees,
  selectedEmployeeId,
  criteria,
  canEdit,
}: EvaluationsClientProps) {
  const t = useTranslations("evaluations");
  const te = useTranslations("employees");
  const tc = useTranslations("common");
  const router = useRouter();

  const [q, setQ] = useState("");
  // Holds the evaluation result after a successful submission
  const [submittedEval, setSubmittedEval] = useState<EvaluationWithItems | null>(null);

  const filtered = q.trim()
    ? employees.filter(
        (emp) =>
          emp.nameAr.toLowerCase().includes(q.toLowerCase()) ||
          (emp.employeeCode ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : employees;

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  const handleSelect = (id: string) => {
    // Reset result view when switching employees
    setSubmittedEval(null);
    router.push(`/evaluations?employeeId=${id}`);
  };

  const handleNewEval = () => {
    setSubmittedEval(null);
  };

  // Translation maps for result display
  const scoreLabels: Record<string, string> = {
    EXCELLENT: t("scoreExcellent"),
    VERY_GOOD: t("scoreVeryGood"),
    GOOD: t("scoreGood"),
    ACCEPTABLE: t("scoreAcceptable"),
  };
  const gradeLabels: Record<string, string> = {
    Excellent: t("gradeExcellent"),
    "Very Good": t("gradeVeryGood"),
    Good: t("gradeGood"),
    Acceptable: t("gradeAcceptable"),
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Employee sidebar */}
      <div className="w-full md:w-72 border-e flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold mb-3">{t("pageTitle")}</h1>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tc("search")}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={te("noEmployees")}
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((emp) => (
                <li key={emp.id}>
                  <button
                    onClick={() => handleSelect(emp.id)}
                    className={cn(
                      "w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors",
                      selectedEmployeeId === emp.id && "bg-primary/10 text-primary"
                    )}
                  >
                    <p className="text-sm font-medium" dir="rtl">{emp.nameAr}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {emp.employeeCode && (
                        <span className="text-xs text-muted-foreground">{emp.employeeCode}</span>
                      )}
                      {emp.site && (
                        <span className="text-xs text-muted-foreground truncate">{emp.site.nameAr}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedEmployee ? (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title={t("selectEmployeeTitle")}
            description={t("selectEmployeeDesc")}
            className="h-full"
          />
        ) : (
          <div>
            {/* Employee identity card */}
            <div className="p-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <EmployeeEvalCard
                  nameAr={selectedEmployee.nameAr}
                  avatarUrl={selectedEmployee.avatarUrl}
                  employeeCode={selectedEmployee.employeeCode}
                  jobTitle={selectedEmployee.jobTitle?.nameAr}
                  site={selectedEmployee.site?.nameAr}
                  hireDate={selectedEmployee.hireDate}
                />
                <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
                  {submittedEval && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewEval}>
                      <Plus className="h-3.5 w-3.5" />
                      {t("newEvaluation")}
                    </Button>
                  )}
                  {/* <Badge variant={selectedEmployee.status === "active" ? "success" : "destructive"}>
                    {selectedEmployee.status === "active" ? te("statusActive") : te("statusFired")}
                  </Badge> */}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* ── Result view ── */}
              {submittedEval ? (() => { 
                const itemCount = submittedEval.items.length;
                const totalWeightedSum = submittedEval.totalScore;
                const averageScore = itemCount > 0
                  ? Math.round((totalWeightedSum / itemCount) * 100) / 100
                  : 0;
                const finalGradeDisplay = submittedEval.finalGrade
                  ? (gradeLabels[submittedEval.finalGrade] ?? submittedEval.finalGrade)
                  : "—";

                return (
                  <div className="space-y-6">
                    {/* Summary card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{t("summaryCard")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("employee")}</dt>
                            <dd className="text-sm font-medium" dir="rtl">{selectedEmployee.nameAr}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("site")}</dt>
                            <dd className="text-sm font-medium">{selectedEmployee.site?.nameAr ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("finalScore")}</dt>
                            <dd className="text-sm font-medium">{averageScore.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("finalGrade")}</dt>
                            <dd>
                              <Badge variant={gradeVariant(submittedEval.finalGrade)}>
                                {finalGradeDisplay}
                              </Badge>
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>

                    {/* Score visualisation */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{t("visualisationCard")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("totalWeightedSum")}</dt>
                            <dd className="text-2xl font-bold">{totalWeightedSum}</dd>
                            <dd className="text-xs text-muted-foreground mt-0.5">
                              {t("acrossCount", { count: itemCount })}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("averageScore")}</dt>
                            <dd className="text-2xl font-bold">{averageScore.toFixed(2)}</dd>
                            <dd className="text-xs text-muted-foreground mt-0.5">
                              {totalWeightedSum} ÷ {itemCount} = {averageScore.toFixed(2)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground mb-0.5">{t("finalGrade")}</dt>
                            <dd className="text-2xl font-bold">
                              <Badge variant={gradeVariant(submittedEval.finalGrade)} className="text-base px-3 py-1">
                                {finalGradeDisplay}
                              </Badge>
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>

                    {/* Breakdown table */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{t("breakdownCard")}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">{t("criterion")}</th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">{t("score")}</th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">{t("notes")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {submittedEval.items.map((item) => (
                                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                  <td className="px-6 py-3 font-medium">{item.criteria.titleAr}</td>
                                  <td className="px-6 py-3">
                                    <Badge variant={gradeVariant(SCORE_TO_GRADE[item.score] ?? null)}>
                                      {scoreLabels[item.score] ?? item.score}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-3 text-muted-foreground">{item.notes ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })() : (
                /* ── Form view ── */
                criteria.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="h-10 w-10" />}
                    title={t("noCriteriaTitle")}
                    description={t("noCriteriaDesc")}
                  />
                ) : (
                  <EvaluationForm
                    employee={{
                      id: selectedEmployee.id,
                      nameAr: selectedEmployee.nameAr,
                      siteId: selectedEmployee.siteId,
                      site: selectedEmployee.site,
                    }}
                    criteria={criteria}
                    existingEvaluation={null}
                    canEdit={canEdit}
                    onSuccess={setSubmittedEval}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
