import { getServerUser } from "@/lib/auth/user";
import { getJobTitleReport } from "@/actions/reports";
import { ReportsClient } from "@/features/reports/reports-client";

export default async function ReportsPage() {
  await getServerUser(); // ensures auth
  const result = await getJobTitleReport();
  const data = result.success ? result.data : { sites: [], jobTitles: [], matrix: {} };

  return <ReportsClient data={data} />;
}
