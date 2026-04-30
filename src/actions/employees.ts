"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/types";
import type { Employee, Prisma } from "@prisma/client";
import { EmployeeStatus } from "@prisma/client";

const AVATAR_BUCKET = "employee-documents";

const employeeSchema = z.object({
  nameAr: z.string().min(1),
  employeeCode: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  status: z.enum(["active", "fired"]).optional().default("active"),
  firedReason: z.string().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  jobTitleId: z.string().uuid().optional().nullable(),
});

/** Upload avatar file and return its storage PATH (not public URL). */
async function uploadAvatar(employeeId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `employee/${employeeId}/avatar/photo.${ext}`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error("[uploadAvatar]", error.message);
    return null;
  }
  // Return the storage path — signed URLs are generated at render time
  return storagePath;
}

/** Delete avatar from storage if it exists. */
async function deleteAvatar(avatarPath: string | null) {
  if (!avatarPath) return;
  // avatarUrl now stores the storage path directly
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
}

/** Generate a signed URL for an avatar storage path. TTL: 1 hour. */
export async function getAvatarSignedUrl(storagePath: string): Promise<ActionResult<{ url: string }>> {
  await getServerUser();
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (error || !data) return { success: false, error: "errors.serverError" };
    return { success: true, data: { url: data.signedUrl } };
  } catch {
    return { success: false, error: "errors.serverError" };
  }
}

export async function createEmployee(formData: FormData): Promise<ActionResult<Employee>> {
  const user = await getServerUser();

  const input = {
    nameAr: formData.get("nameAr"),
    employeeCode: formData.get("employeeCode") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    address: formData.get("address") || null,
    hireDate: formData.get("hireDate") || null,
    status: formData.get("status"),
    firedReason: formData.get("firedReason") || null,
    siteId: formData.get("siteId") || null,
    jobTitleId: formData.get("jobTitleId") || null,
  };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const avatarFile = formData.get("avatar") as File | null;
  if (!avatarFile || avatarFile.size === 0) {
    return { success: false, error: "errors.avatarRequired" };
  }

  const siteId = isSuperAdmin(user) ? (parsed.data.siteId ?? null) : user.siteId;

  try {
    // Create employee first to get the ID
    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        siteId,
        email: parsed.data.email || null,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : null,
      },
    });

    // Upload avatar
    const avatarUrl = await uploadAvatar(employee.id, avatarFile);
    if (!avatarUrl) {
      await prisma.employee.delete({ where: { id: employee.id } });
      return { success: false, error: "errors.uploadFailed" };
    }

    const result = await prisma.employee.update({
      where: { id: employee.id },
      data: { avatarUrl },
    });

    revalidatePath("/[locale]/employees", "page");
    return { success: true, data: result };
  } catch (err) {
    console.error("[createEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateEmployee(id: string, input: unknown, avatarFile?: File | null): Promise<ActionResult<Employee>> {
  const user = await getServerUser();
  const parsed = employeeSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  if (!isSuperAdmin(user)) {
    const existing = await prisma.employee.findUnique({ where: { id }, select: { siteId: true } });
    if (!existing || existing.siteId !== user.siteId) {
      return { success: false, error: "errors.forbidden" };
    }
    delete parsed.data.siteId;
  }

  try {
    let avatarUrl: string | undefined;
    if (avatarFile && avatarFile.size > 0) {
      // Delete old avatar first
      const existing = await prisma.employee.findUnique({ where: { id }, select: { avatarUrl: true } });
      await deleteAvatar(existing?.avatarUrl ?? null);
      const url = await uploadAvatar(id, avatarFile);
      if (url) avatarUrl = url;
    }

    const result = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(avatarUrl ? { avatarUrl } : {}),
        email: parsed.data.email !== undefined ? (parsed.data.email || null) : undefined,
        hireDate: parsed.data.hireDate !== undefined
          ? parsed.data.hireDate ? new Date(parsed.data.hireDate) : null
          : undefined,
      },
    });
    revalidatePath("/[locale]/employees", "page");
    return { success: true, data: result };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as any).code === "P2025") {
      return { success: false, error: "errors.notFound" };
    }
    console.error("[updateEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();

  // site_admin can only delete employees in their site
  if (!isSuperAdmin(user)) {
    const existing = await prisma.employee.findUnique({ where: { id }, select: { siteId: true } });
    if (!existing || existing.siteId !== user.siteId) {
      return { success: false, error: "errors.forbidden" };
    }
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [documents, employee] = await Promise.all([
      prisma.document.findMany({
        where: { employeeId: id },
        select: { storageBucket: true, storagePath: true },
      }),
      prisma.employee.findUnique({ where: { id }, select: { avatarUrl: true } }),
    ]);
    for (const doc of documents) {
      await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]);
    }
    await deleteAvatar(employee?.avatarUrl ?? null);
    await prisma.employee.delete({ where: { id } });
    revalidatePath("/[locale]/employees", "page");
    return { success: true, data: null };
  } catch (err) {
    console.error("[deleteEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function listEmployees(params: {
  q?: string;
  status?: string;
  siteId?: string;
  jobTitleId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ActionResult<{ items: (Employee & { site: { nameAr: string } | null; jobTitle: { nameAr: string } | null })[]; total: number }>> {
  const user = await getServerUser();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: Prisma.EmployeeWhereInput = {};

  // site_admin always scoped to their site
  if (!isSuperAdmin(user)) {
    where.siteId = user.siteId ?? undefined;
  } else if (params.siteId && params.siteId !== "all") {
    where.siteId = params.siteId;
  }

  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { nameAr: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.status && params.status !== "all") {
    where.status = params.status as EmployeeStatus;
  }

  if (params.jobTitleId && params.jobTitleId !== "all") {
    where.jobTitleId = params.jobTitleId;
  }

  const [items, total] = await prisma.$transaction([
    (prisma as any).employee.findMany({
      where,
      include: { site: { select: { nameAr: true } }, jobTitle: { select: { nameAr: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return { success: true, data: { items, total } };
}

export async function getEmployeeStats(): Promise<
  ActionResult<{ total: number; active: number; fired: number }>
> {
  const user = await getServerUser();
  const where: Prisma.EmployeeWhereInput = isSuperAdmin(user)
    ? {}
    : { siteId: user.siteId ?? undefined };

  const groups = await prisma.employee.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const counts = { active: 0, fired: 0 };
  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return { success: true, data: { total: counts.active + counts.fired, ...counts } };
}
