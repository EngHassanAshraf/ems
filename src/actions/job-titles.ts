"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import type { ActionResult } from "@/actions/types";

export type JobTitleRow = {
  id: string;
  nameAr: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const schema = z.object({
  nameAr: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export async function listJobTitles(all = false): Promise<ActionResult<JobTitleRow[]>> {
  await getServerUser();
  const items = await prisma.jobTitle.findMany({
    where: all ? undefined : { isActive: true },
    orderBy: { nameAr: "asc" },
  });
  return { success: true, data: items };
}

export async function createJobTitle(input: unknown): Promise<ActionResult<JobTitleRow>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };
  try {
    const item = await prisma.jobTitle.create({ data: parsed.data });
    revalidatePath("/job-titles");
    return { success: true, data: item };
  } catch (err) {
    console.error("[createJobTitle]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateJobTitle(id: string, input: unknown): Promise<ActionResult<JobTitleRow>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };
  const parsed = schema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };
  try {
    const item = await prisma.jobTitle.update({ where: { id }, data: parsed.data });
    revalidatePath("/job-titles");
    return { success: true, data: item };
  } catch (err) {
    console.error("[updateJobTitle]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteJobTitle(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };
  try {
    await prisma.jobTitle.delete({ where: { id } });
    revalidatePath("/job-titles");
    return { success: true, data: null };
  } catch (err) {
    console.error("[deleteJobTitle]", err);
    return { success: false, error: "errors.serverError" };
  }
}
