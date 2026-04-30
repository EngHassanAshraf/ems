import { notFound, redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/user";
import { getUser } from "@/actions/users";
import { listSites } from "@/actions/sites";
import { UserProfileClient } from "@/features/users/user-profile-client";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getServerUser();
  if (currentUser.role !== "super_admin") redirect("/dashboard");

  const [userResult, sitesResult] = await Promise.all([
    getUser(id),
    listSites(true),
  ]);

  if (!userResult.success) notFound();

  const profile = userResult.data;
  const sites = sitesResult.success ? sitesResult.data : [];

  return <UserProfileClient profile={profile} sites={sites} currentUserId={currentUser.id} />;
}
