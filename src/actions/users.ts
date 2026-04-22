"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import type { ActionResult } from "@/actions/types";

// Admin client uses service role — never expose to browser
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullNameAr: z.string().min(1),
  role: z.enum(["super_admin", "site_admin", "site_security_manager"]),
  siteId: z.string().uuid().optional().nullable(),
});

export type UserListItem = {
  id: string;
  email: string;
  fullNameAr: string | null;
  role: string;
  siteId: string | null;
  siteName: string | null;
  isActive: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<ActionResult<UserListItem[]>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  const profiles = await prisma.userProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { site: { select: { nameAr: true } } },
  });

  return {
    success: true,
    data: profiles.map((p) => ({
      id: p.id,
      email: p.email ?? "",
      fullNameAr: p.fullNameAr,
      role: p.role,
      siteId: p.siteId,
      siteName: (p as any).site?.nameAr ?? null,
      isActive: p.isActive,
      createdAt: p.createdAt,
    })),
  };
}

export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const { email, password, fullNameAr, role, siteId } = parsed.data;

  // site_admin and site_security_manager must have a site assigned
  if (role !== "super_admin" && !siteId) {
    return { success: false, error: "errors.siteRequired" };
  }

  console.log("[createUser] creating:", { email, role, siteId });

  const admin = getAdminClient();

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullNameAr },
  });

  console.log("[createUser] auth result:", authData?.user?.id, authError?.message);

  if (authError || !authData.user) {
    console.error("[createUser] auth error:", authError?.message);
    return { success: false, error: "errors.serverError" };
  }

  // Update the user_profile created by the trigger with role + siteId
  // Use raw upsert to avoid timing issues with the trigger
  try {
    await new Promise((r) => setTimeout(r, 800));

    await prisma.$executeRaw`
      INSERT INTO public.user_profiles (id, email, full_name_ar, role, site_id, is_active, created_at, updated_at)
      VALUES (
        ${authData.user.id}::uuid,
        ${email},
        ${fullNameAr},
        ${role}::public.user_role,
        ${siteId ?? null}::uuid,
        true,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name_ar = EXCLUDED.full_name_ar,
        role = EXCLUDED.role,
        site_id = EXCLUDED.site_id,
        updated_at = now()
    `;
  } catch (err) {
    console.error("[createUser] profile error:", err);
    await admin.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: "errors.serverError" };
  }

  revalidatePath("/[locale]/users", "page");
  return { success: true, data: { id: authData.user.id } };
}

export async function updateUserRole(
  id: string,
  input: { role: "super_admin" | "site_admin" | "site_security_manager"; siteId?: string | null }
): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  try {
    await prisma.userProfile.update({
      where: { id },
      data: {
        role: input.role as any,
        siteId: input.siteId ?? null,
      },
    });
    revalidatePath("/[locale]/users", "page");
    return { success: true, data: null };
  } catch (err) {
    console.error("[updateUserRole]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteUser(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };
  if (id === user.id) return { success: false, error: "errors.cannotDeleteSelf" };

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("[deleteUser]", error.message);
    return { success: false, error: "errors.serverError" };
  }

  revalidatePath("/[locale]/users", "page");
  return { success: true, data: null };
}
