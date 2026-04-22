import { getServerUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { fullNameAr: true, avatarUrl: true },
  });

  return (
    <AppShell
      isSuperAdmin={user.role === "super_admin"}
      userName={profile?.fullNameAr ?? user.email ?? null}
      userRole={user.role}
      avatarUrl={profile?.avatarUrl ?? null}
    >
      {children}
    </AppShell>
  );
}
