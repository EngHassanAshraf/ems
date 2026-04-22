"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import type { ActionResult } from "@/actions/types";

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
  phone: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  fullNameAr: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  role: z.enum(["super_admin", "site_admin", "site_security_manager"]),
  siteId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UserListItem = {
  id: string;
  email: string;
  fullNameAr: string | null;
  phone: string | null;
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
      phone: p.phone,
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

  const { email, password, fullNameAr, role, siteId, phone } = parsed.data;

  if (role !== "super_admin" && !siteId) {
    return { success: false, error: "errors.siteRequired" };
  }

  const admin = getAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullNameAr },
  });

  if (authError || !authData.user) {
    console.error("[createUser] auth error:", authError?.message);
    return { success: false, error: "errors.serverError" };
  }

  try {
    await new Promise((r) => setTimeout(r, 800));

    await prisma.$executeRaw`
      INSERT INTO public.user_profiles (id, email, full_name_ar, phone, role, site_id, is_active, created_at, updated_at)
      VALUES (
        ${authData.user.id}::uuid,
        ${email},
        ${fullNameAr},
        ${phone ?? null},
        ${role}::public.user_role,
        ${siteId ?? null}::uuid,
        true,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name_ar = EXCLUDED.full_name_ar,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        site_id = EXCLUDED.site_id,
        updated_at = now()
    `;
  } catch (err) {
    console.error("[createUser] profile error:", err);
    await admin.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: "errors.serverError" };
  }

  revalidatePath("/users");
  return { success: true, data: { id: authData.user.id } };
}

export async function updateUser(id: string, input: unknown): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const { email, password, fullNameAr, phone, role, siteId, isActive } = parsed.data;

  const admin = getAdminClient();

  // Update auth user (email and/or password)
  const authUpdates: Record<string, unknown> = {};
  if (email) authUpdates.email = email;
  if (password) authUpdates.password = password;

  if (Object.keys(authUpdates).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdates);
    if (error) {
      console.error("[updateUser] auth error:", error.message);
      return { success: false, error: "errors.serverError" };
    }
  }

  // Update profile
  try {
    await prisma.userProfile.update({
      where: { id },
      data: {
        ...(fullNameAr !== undefined && { fullNameAr }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role: role as any }),
        ...(siteId !== undefined && { siteId: siteId ?? null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    revalidatePath("/users");
    return { success: true, data: null };
  } catch (err) {
    console.error("[updateUser]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteUser(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };
  if (id === user.id) return { success: false, error: "errors.cannotDeleteSelf" };

  // Delete profile first (FK constraint), then auth user
  try {
    await prisma.userProfile.delete({ where: { id } });
  } catch (err) {
    console.error("[deleteUser] profile delete:", err);
    // Continue even if profile doesn't exist
  }

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("[deleteUser]", error.message);
    return { success: false, error: "errors.serverError" };
  }

  revalidatePath("/users");
  return { success: true, data: null };
}
