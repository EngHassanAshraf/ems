import { listEmployees } from "@/actions/employees";
import { listSites } from "@/actions/sites";
import { listJobTitles } from "@/actions/job-titles";
import { getServerUser } from "@/lib/auth/user";
import { EmployeesClient } from "@/features/employees/employees-client";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; siteId?: string; jobTitleId?: string; page?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getServerUser()]);
  const q = params.q ?? "";
  const status = params.status ?? "all";
  const siteId = params.siteId ?? "all";
  const jobTitleId = params.jobTitleId ?? "all";
  const page = Number(params.page ?? 1);
  const PAGE_SIZE = 15;

  const [result, sitesResult, jobTitlesResult] = await Promise.all([
    listEmployees({ q, status, siteId, jobTitleId, page, pageSize: PAGE_SIZE }),
    listSites(true),
    listJobTitles(),
  ]);

  const employees = result.success ? result.data.items : [];
  const total = result.success ? result.data.total : 0;
  const sites = sitesResult.success ? sitesResult.data : [];
  const jobTitles = jobTitlesResult.success ? jobTitlesResult.data : [];

  return (
    <EmployeesClient
      employees={employees}
      total={total}
      sites={sites}
      jobTitles={jobTitles}
      isSuperAdmin={user.role === "super_admin"}
      userSiteId={user.siteId}
      initialQ={q}
      initialStatus={status}
      initialSiteId={siteId}
      initialJobTitleId={jobTitleId}
      initialPage={page}
      pageSize={PAGE_SIZE}
    />
  );
}
