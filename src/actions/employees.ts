"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/types";
import type { Employee, Prisma } from "@prisma/client";
import { EmployeeStatus } from "@prisma/client";

const employeeSchema = z.object({
  nameAr: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  status: z.enum(["active", "fired"]).optional().default("active"),
  firedReason: z.string().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  jobTitleId: z.string().uuid().optional().nullable(),
});

export async function createEmployee(input: unknown): Promise<ActionResult<Employee>> {
  const user = await getServerUser();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  // site_admin can only create employees for their own site
  const siteId = isSuperAdmin(user)
    ? (parsed.data.siteId ?? null)
    : user.siteId;

  try {
    const result = await prisma.employee.create({
      data: {
        ...parsed.data,
        siteId,
        email: parsed.data.email || null,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : null,
      },
    });
    revalidatePath("/[locale]/employees", "page");
    return { success: true, data: result };
  } catch (err) {
    console.error("[createEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult<Employee>> {
  const user = await getServerUser();
  const parsed = employeeSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  // site_admin can only update employees in their site
  if (!isSuperAdmin(user)) {
    const existing = await prisma.employee.findUnique({ where: { id }, select: { siteId: true } });
    if (!existing || existing.siteId !== user.siteId) {
      return { success: false, error: "errors.forbidden" };
    }
    // prevent site_admin from changing siteId
    delete parsed.data.siteId;
  }

  try {
    const result = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
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
    const documents = await prisma.document.findMany({
      where: { employeeId: id },
      select: { storageBucket: true, storagePath: true },
    });
    for (const doc of documents) {
      await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]);
    }
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
