"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerUser, isSuperAdmin } from "@/lib/auth/user";
import type { ActionResult } from "@/actions/types";
import type { SiteRow } from "@/features/sites/sites-client";

const siteSchema = z.object({
  nameAr: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export async function listSites(all = false): Promise<ActionResult<SiteRow[]>> {
  const user = await getServerUser();
  // site_admin only sees their own site
  const where = isSuperAdmin(user)
    ? (all ? undefined : { isActive: true })
    : { id: user.siteId ?? "__none__" };

  const sites = await (prisma as any).site.findMany({
    where,
    orderBy: { nameAr: "asc" },
  });
  return { success: true, data: sites };
}

export async function createSite(input: unknown): Promise<ActionResult<SiteRow>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };
  try {
    const site = await (prisma as any).site.create({ data: parsed.data });
    revalidatePath("/[locale]/sites", "page");
    return { success: true, data: site };
  } catch (err) {
    console.error("[createSite]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateSite(id: string, input: unknown): Promise<ActionResult<SiteRow>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  const parsed = siteSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };
  try {
    const site = await (prisma as any).site.update({ where: { id }, data: parsed.data });
    revalidatePath("/[locale]/sites", "page");
    return { success: true, data: site };
  } catch (err) {
    console.error("[updateSite]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteSite(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();
  if (!isSuperAdmin(user)) return { success: false, error: "errors.forbidden" };

  try {
    await (prisma as any).site.delete({ where: { id } });
    revalidatePath("/[locale]/sites", "page");
    return { success: true, data: null };
  } catch (err) {
    console.error("[deleteSite]", err);
    return { success: false, error: "errors.serverError" };
  }
}
