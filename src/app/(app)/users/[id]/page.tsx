import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Pencil } from "lucide-react";
import { getServerUser } from "@/lib/auth/user";
import { getUser } from "@/actions/users";
import { listSites } from "@/actions/sites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
