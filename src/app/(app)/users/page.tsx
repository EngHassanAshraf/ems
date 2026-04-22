import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/user";
import { listUsers } from "@/actions/users";
import { listSites } from "@/actions/sites";
import { UsersClient } from "@/features/users/users-client";

export default async function UsersPage() {
  const user = await getServerUser();
  if (user.role !== "super_admin") redirect("/dashboard");

  const [usersResult, sitesResult] = await Promise.all([listUsers(), listSites(true)]);
  const users = usersResult.success ? usersResult.data : [];
  const sites = sitesResult.success ? sitesResult.data : [];

  return <UsersClient users={users} sites={sites} currentUserId={user.id} />;
}
