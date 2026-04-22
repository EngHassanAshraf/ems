import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/user";
import { listJobTitles } from "@/actions/job-titles";
import { JobTitlesClient } from "@/features/job-titles/job-titles-client";

export default async function JobTitlesPage() {
  const user = await getServerUser();
  if (user.role !== "super_admin") redirect("/dashboard");

  const result = await listJobTitles(true);
  const jobTitles = result.success ? result.data : [];

  return <JobTitlesClient jobTitles={jobTitles} />;
}
