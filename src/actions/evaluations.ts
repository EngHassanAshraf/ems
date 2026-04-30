"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getServerUser,
  isSuperAdmin,
  isSiteAdmin,
  isSiteSecurityManager,
} from "@/lib/auth/user";
import { calculateEvaluationScore } from "@/lib/evaluation/score";
import type { ActionResult } from "@/actions/types";
import type { EvaluationCriteria, EmployeeEvaluation } from "@prisma/client";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const criteriaSchema = z.object({
  titleAr: z.string().min(1),
  descriptionAr: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const evaluationItemSchema = z.object({
  criteriaId: z.string().uuid(),
  score: z.enum(["EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE"]),
  notes: z.string().optional().nullable(),
});

const createEvaluationSchema = z.object({
  employeeId: z.string().uuid(),
  items: z.array(evaluationItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// Criteria management (super_admin only)
// ---------------------------------------------------------------------------

export async function createCriteria(
  input: unknown
): Promise<ActionResult<EvaluationCriteria>> {
  const user = await getServerUser();

  if (!isSuperAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  const parsed = criteriaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  try {
    const result = await prisma.evaluationCriteria.create({
      data: {
        titleAr: parsed.data.titleAr,
        descriptionAr: parsed.data.descriptionAr ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { success: true, data: result };
  } catch (err) {
    console.error("[createCriteria]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateCriteria(
  id: string,
  input: unknown
): Promise<ActionResult<EvaluationCriteria>> {
  const user = await getServerUser();

  if (!isSuperAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  const parsed = criteriaSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  try {
    const result = await prisma.evaluationCriteria.update({
      where: { id },
      data: {
        ...(parsed.data.titleAr !== undefined && { titleAr: parsed.data.titleAr }),
        ...(parsed.data.descriptionAr !== undefined && {
          descriptionAr: parsed.data.descriptionAr,
        }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });
    return { success: true, data: result };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "errors.notFound" };
    }
    console.error("[updateCriteria]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteCriteria(id: string): Promise<ActionResult<null>> {
  const user = await getServerUser();

  if (!isSuperAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  try {
    await prisma.evaluationCriteria.delete({ where: { id } });
    return { success: true, data: null };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "errors.notFound" };
    }
    console.error("[deleteCriteria]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function listCriteria(
  activeOnly?: boolean
): Promise<ActionResult<EvaluationCriteria[]>> {
  await getServerUser();

  try {
    const results = await prisma.evaluationCriteria.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: results };
  } catch (err) {
    console.error("[listCriteria]", err);
    return { success: false, error: "errors.serverError" };
  }
}

// ---------------------------------------------------------------------------
// Evaluation CRUD
// ---------------------------------------------------------------------------

export async function createEvaluation(
  input: unknown
): Promise<ActionResult<EmployeeEvaluation>> {
  const user = await getServerUser();

  // site_admin is always forbidden
  if (isSiteAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  const parsed = createEvaluationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { employeeId, items } = parsed.data;

  // Fetch employee to get siteId for RBAC check
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { siteId: true },
  });

  if (!employee) {
    return { success: false, error: "errors.notFound" };
  }

  // site_security_manager can only evaluate employees at their own site
  if (isSiteSecurityManager(user) && employee.siteId !== user.siteId) {
    return { success: false, error: "errors.forbidden" };
  }

  // Compute scores
  const scoreResult = calculateEvaluationScore(items);
  if (!scoreResult.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { totalScore, finalGrade } = scoreResult.data;

  try {
    const evaluation = await prisma.$transaction(async (tx) => {
      const created = await tx.employeeEvaluation.create({
        data: {
          employeeId,
          siteId: employee.siteId!,
          createdBy: user.id,
          totalScore,
          finalGrade,
        },
      });

      await tx.employeeEvaluationItem.createMany({
        data: items.map((item) => ({
          evaluationId: created.id,
          criteriaId: item.criteriaId,
          score: item.score,
          notes: item.notes ?? null,
        })),
      });

      return created;
    });

    revalidatePath(`/[locale]/employees/${employeeId}/evaluations`, "page");

    return { success: true, data: evaluation };
  } catch (err) {
    console.error("[createEvaluation]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateEvaluation(
  id: string,
  input: unknown
): Promise<ActionResult<EmployeeEvaluation>> {
  const user = await getServerUser();

  // site_admin is always forbidden
  if (isSiteAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  const parsed = createEvaluationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { employeeId, items } = parsed.data;

  // Load existing evaluation
  const existing = await prisma.employeeEvaluation.findUnique({
    where: { id },
    select: { id: true, siteId: true },
  });

  if (!existing) {
    return { success: false, error: "errors.notFound" };
  }

  // site_security_manager can only update evaluations at their own site
  if (isSiteSecurityManager(user) && existing.siteId !== user.siteId) {
    return { success: false, error: "errors.forbidden" };
  }

  // Recompute scores from new items
  const scoreResult = calculateEvaluationScore(items);
  if (!scoreResult.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { totalScore, finalGrade } = scoreResult.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.employeeEvaluationItem.deleteMany({
        where: { evaluationId: id },
      });

      // Re-create new items
      await tx.employeeEvaluationItem.createMany({
        data: items.map((item) => ({
          evaluationId: id,
          criteriaId: item.criteriaId,
          score: item.score,
          notes: item.notes ?? null,
        })),
      });

      // Update the evaluation record with recomputed scores
      return tx.employeeEvaluation.update({
        where: { id },
        data: {
          employeeId,
          totalScore,
          finalGrade,
        },
      });
    });

    revalidatePath(`/[locale]/employees/${employeeId}/evaluations`, "page");

    return { success: true, data: updated };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "errors.notFound" };
    }
    console.error("[updateEvaluation]", err);
    return { success: false, error: "errors.serverError" };
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export type EvaluationWithItems = EmployeeEvaluation & {
  items: (import("@prisma/client").EmployeeEvaluationItem & {
    criteria: EvaluationCriteria;
  })[];
};

export async function getEmployeeEvaluations(
  employeeId: string
): Promise<ActionResult<EmployeeEvaluation[]>> {
  const user = await getServerUser();

  // site_admin is always forbidden
  if (isSiteAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  // Fetch employee to get siteId for RBAC check
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { siteId: true },
  });

  if (!employee) {
    return { success: false, error: "errors.notFound" };
  }

  // site_security_manager can only view evaluations for employees at their own site
  if (isSiteSecurityManager(user) && employee.siteId !== user.siteId) {
    return { success: false, error: "errors.forbidden" };
  }

  try {
    const evaluations = await prisma.employeeEvaluation.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: evaluations };
  } catch (err) {
    console.error("[getEmployeeEvaluations]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function getEvaluationById(
  id: string
): Promise<ActionResult<EvaluationWithItems>> {
  const user = await getServerUser();

  // site_admin is always forbidden
  if (isSiteAdmin(user)) {
    return { success: false, error: "errors.forbidden" };
  }

  const evaluation = await prisma.employeeEvaluation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          criteria: true,
        },
      },
    },
  });

  if (!evaluation) {
    return { success: false, error: "errors.notFound" };
  }

  // site_security_manager can only view evaluations from their own site
  if (isSiteSecurityManager(user) && evaluation.siteId !== user.siteId) {
    return { success: false, error: "errors.forbidden" };
  }

  return { success: true, data: evaluation };
}
