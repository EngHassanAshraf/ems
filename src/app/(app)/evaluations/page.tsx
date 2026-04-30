import { redirect } from "next/navigation";
import { getServerUser, isSiteAdmin, isSuperAdmin, isSiteSecurityManager } from "@/lib/auth/user";
import { listEmployees } from "@/actions/employees";
import { listCriteria } from "@/actions/evaluations";
import { EvaluationsClient } from "@/features/evaluations/evaluations-client";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const user = await getServerUser();

  // site_admin has no access to evaluations
  if (isSiteAdmin(user)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const selectedEmployeeId = params.employeeId ?? null;

  // Fetch employees scoped by role (listEmployees already handles site scoping)
  const employeesResult = await listEmployees({ page: 1, pageSize: 200, status: "active" });
  const employees = employeesResult.success ? employeesResult.data.items : [];

  // Fetch active criteria for the form
  const criteriaResult = await listCriteria(true);
  const criteria = criteriaResult.success ? criteriaResult.data : [];

  // canEdit: super_admin always; site_security_manager only for employees at their site
  // The form itself enforces this — we compute a page-level default here
  // (per-employee canEdit is re-evaluated inside the form via the server action)
  const selectedEmployee = selectedEmployeeId
    ? employees.find((e) => e.id === selectedEmployeeId) ?? null
    : null;

  const canEdit = isSuperAdmin(user)
    ? true
    : isSiteSecurityManager(user)
    ? selectedEmployee?.siteId === user.siteId
    : false;

  return (
    <EvaluationsClient
      employees={employees}
      selectedEmployeeId={selectedEmployeeId}
      criteria={criteria}
      existingEvaluation={null}
      canEdit={canEdit}
    />
  );
}
