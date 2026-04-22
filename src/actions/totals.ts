"use server";

import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import type { ActionResult } from "@/actions/types";

export type SiteJobTitleCount = {
  siteId: string;
  siteNameAr: string;
  jobTitleId: string;
  jobTitleNameAr: string;
  count: number;
};

export type ReportData = {
  sites: { id: string; nameAr: string }[];
  jobTitles: { id: string; nameAr: string }[];
  // map[siteId][jobTitleId] = count
  matrix: Record<string, Record<string, number>>;
};

export async function getJobTitleReport(): Promise<ActionResult<ReportData>> {
  const user = await getServerUser();

  // Build site filter based on role
  const siteFilter = isSuperAdmin(user)
    ? undefined
    : user.siteId
    ? { id: user.siteId }
    : { id: "__none__" };

  // Fetch active employees with their site and job title
  const employees = await prisma.employee.findMany({
    where: {
      status: "active",
      siteId: { not: null },
      jobTitleId: { not: null },
      ...(siteFilter ? { site: siteFilter } : {}),
    },
    select: {
      siteId: true,
      jobTitleId: true,
      site: { select: { id: true, nameAr: true } },
      jobTitle: { select: { id: true, nameAr: true } },
    },
  });

  // Build unique sites and job titles from the data
  const sitesMap = new Map<string, string>();
  const jobTitlesMap = new Map<string, string>();
  const matrix: Record<string, Record<string, number>> = {};

  for (const emp of employees) {
    if (!emp.site || !emp.jobTitle) continue;

    sitesMap.set(emp.site.id, emp.site.nameAr);
    jobTitlesMap.set(emp.jobTitle.id, emp.jobTitle.nameAr);

    if (!matrix[emp.site.id]) matrix[emp.site.id] = {};
    matrix[emp.site.id][emp.jobTitle.id] = (matrix[emp.site.id][emp.jobTitle.id] ?? 0) + 1;
  }

  // If site_admin has no employees yet, still show their site
  if (!isSuperAdmin(user) && user.siteId) {
    const site = await (prisma as any).site.findUnique({
      where: { id: user.siteId },
      select: { id: true, nameAr: true },
    });
    if (site && !sitesMap.has(site.id)) {
      sitesMap.set(site.id, site.nameAr);
    }
  }

  // Also fetch all active job titles so columns are consistent
  const allJobTitles = await prisma.jobTitle.findMany({
    where: { isActive: true },
    select: { id: true, nameAr: true },
    orderBy: { nameAr: "asc" },
  });

  for (const jt of allJobTitles) {
    jobTitlesMap.set(jt.id, jt.nameAr);
  }

  return {
    success: true,
    data: {
      sites: Array.from(sitesMap.entries())
        .map(([id, nameAr]) => ({ id, nameAr }))
        .sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar")),
      jobTitles: Array.from(jobTitlesMap.entries())
        .map(([id, nameAr]) => ({ id, nameAr }))
        .sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar")),
      matrix,
    },
  };
}
