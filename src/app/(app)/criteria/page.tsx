import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/user";
import { listCriteria } from "@/actions/evaluations";
import { CriteriaClient } from "@/features/evaluations/criteria-client";

export default async function CriteriaPage() {
  const user = await getServerUser();
  if (user.role !== "super_admin") redirect("/dashboard");

  const result = await listCriteria();
  const criteria = result.success ? result.data : [];

  return <CriteriaClient criteria={criteria} />;
}
