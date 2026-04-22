import { getServerUser } from "@/lib/auth/user";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  return <AppShell isSuperAdmin={user.role === "super_admin"}>{children}</AppShell>;
}
