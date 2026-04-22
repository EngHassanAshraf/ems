"use client";

import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReportData } from "@/actions/reports";

interface ReportsClientProps {
  data: ReportData;
}

export function ReportsClient({ data }: ReportsClientProps) {
  const t = useTranslations("reports");
  const { sites, jobTitles, matrix } = data;

  // Compute totals per job title (last row)
  const jobTitleTotals: Record<string, number> = {};
  for (const jt of jobTitles) {
    jobTitleTotals[jt.id] = sites.reduce(
      (sum, site) => sum + (matrix[site.id]?.[jt.id] ?? 0),
      0
    );
  }

  // Row total per site
  const siteTotals: Record<string, number> = {};
  for (const site of sites) {
    siteTotals[site.id] = jobTitles.reduce(
      (sum, jt) => sum + (matrix[site.id]?.[jt.id] ?? 0),
      0
    );
  }

  const grandTotal = Object.values(siteTotals).reduce((a, b) => a + b, 0);

  if (sites.length === 0 || jobTitles.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title={t("noData")}
          description={t("noDataDesc")}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium sticky start-0 bg-muted/50 min-w-[140px]">
                {t("site")}
              </th>
              {jobTitles.map((jt) => (
                <th key={jt.id} className="p-3 text-center font-medium whitespace-nowrap">
                  {jt.nameAr}
                </th>
              ))}
              <th className="p-3 text-center font-medium whitespace-nowrap bg-muted/80">
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sites.map((site) => (
              <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium sticky start-0 bg-card">{site.nameAr}</td>
                {jobTitles.map((jt) => {
                  const count = matrix[site.id]?.[jt.id] ?? 0;
                  return (
                    <td key={jt.id} className="p-3 text-center">
                      {count > 0 ? (
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                          {count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="p-3 text-center font-semibold bg-muted/20">
                  {siteTotals[site.id] > 0 ? siteTotals[site.id] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/50 font-semibold">
              <td className="p-3 sticky start-0 bg-muted/50">{t("total")}</td>
              {jobTitles.map((jt) => (
                <td key={jt.id} className="p-3 text-center">
                  {jobTitleTotals[jt.id] > 0 ? (
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 text-primary font-bold text-xs">
                      {jobTitleTotals[jt.id]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
              <td className="p-3 text-center text-primary font-bold">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
