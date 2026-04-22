import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type UserRole = "super_admin" | "site_admin";

export type ServerUser = {
  id: string;
  email: string | undefined;
  role: UserRole;
  siteId: string | null;
};

export function isSuperAdmin(user: ServerUser) {
  return user.role === "super_admin";
}

export function isSiteAdmin(user: ServerUser) {
  return user.role === "site_admin";
}

/**
 * Returns the authenticated user with their role and site assignment.
 * Redirects to login if unauthenticated.
 */
export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login" as any);
  }

  // Fetch role and siteId from user_profiles
  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true, siteId: true },
  });

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role ?? "site_admin") as UserRole,
    siteId: profile?.siteId ?? null,
  };
}
