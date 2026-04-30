// Feature: employee-evaluation-system, Property 5: Criteria mutation is forbidden for non-super_admin roles

/**
 * Validates: Requirements 1.3, 10.1, 10.3
 */

import * as fc from "fast-check";
import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockGetServerUser,
  mockEvaluationCriteriaCreate,
  mockEvaluationCriteriaUpdate,
  mockEvaluationCriteriaDelete,
  mockEvaluationCriteriaFindMany,
  mockEmployeeFindUnique,
  mockEmployeeEvaluationCreate,
  mockEmployeeEvaluationItemCreateMany,
  mockEmployeeEvaluationFindUnique,
  mockEmployeeEvaluationUpdate,
  mockEmployeeEvaluationItemDeleteMany,
} = vi.hoisted(() => {
    const mockGetServerUser = vi.fn();
    const mockEvaluationCriteriaCreate = vi.fn();
    const mockEvaluationCriteriaUpdate = vi.fn();
    const mockEvaluationCriteriaDelete = vi.fn();
    const mockEvaluationCriteriaFindMany = vi.fn();
    const mockEmployeeFindUnique = vi.fn();
    const mockEmployeeEvaluationCreate = vi.fn();
    const mockEmployeeEvaluationItemCreateMany = vi.fn();
    const mockEmployeeEvaluationFindUnique = vi.fn();
    const mockEmployeeEvaluationUpdate = vi.fn();
    const mockEmployeeEvaluationItemDeleteMany = vi.fn();
    return {
      mockGetServerUser,
      mockEvaluationCriteriaCreate,
      mockEvaluationCriteriaUpdate,
      mockEvaluationCriteriaDelete,
      mockEvaluationCriteriaFindMany,
      mockEmployeeFindUnique,
      mockEmployeeEvaluationCreate,
      mockEmployeeEvaluationItemCreateMany,
      mockEmployeeEvaluationFindUnique,
      mockEmployeeEvaluationUpdate,
      mockEmployeeEvaluationItemDeleteMany,
    };
  });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evaluationCriteria: {
      create: mockEvaluationCriteriaCreate,
      update: mockEvaluationCriteriaUpdate,
      delete: mockEvaluationCriteriaDelete,
      findMany: mockEvaluationCriteriaFindMany,
    },
    employee: {
      findUnique: mockEmployeeFindUnique,
    },
    employeeEvaluation: {
      create: mockEmployeeEvaluationCreate,
      findUnique: mockEmployeeEvaluationFindUnique,
      update: mockEmployeeEvaluationUpdate,
    },
    employeeEvaluationItem: {
      createMany: mockEmployeeEvaluationItemCreateMany,
      deleteMany: mockEmployeeEvaluationItemDeleteMany,
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth/user", () => ({
  getServerUser: mockGetServerUser,
  isSuperAdmin: (user: { role: string }) => user.role === "super_admin",
  isSiteAdmin: (user: { role: string }) => user.role === "site_admin",
  isSiteSecurityManager: (user: { role: string }) => user.role === "site_security_manager",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// --- Import after mocks ---
import { createCriteria, updateCriteria, deleteCriteria, listCriteria, createEvaluation, updateEvaluation } from "../evaluations";
import { calculateEvaluationScore } from "@/lib/evaluation/score";

// --- Tests ---

describe("Property 5: Criteria mutation is forbidden for non-super_admin roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createCriteria returns forbidden for non-super_admin roles", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("site_admin", "site_security_manager"),
        fc.record({ titleAr: fc.string() }),
        async (role, input) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "test@example.com",
            role,
            siteId: "site-1",
          });

          const result = await createCriteria(input);

          expect(result).toEqual({ success: false, error: "errors.forbidden" });
          expect(mockEvaluationCriteriaCreate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("updateCriteria returns forbidden for non-super_admin roles", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("site_admin", "site_security_manager"),
        fc.record({ titleAr: fc.string() }),
        async (role, input) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "test@example.com",
            role,
            siteId: "site-1",
          });

          const result = await updateCriteria("some-id", input);

          expect(result).toEqual({ success: false, error: "errors.forbidden" });
          expect(mockEvaluationCriteriaUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("deleteCriteria returns forbidden for non-super_admin roles", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("site_admin", "site_security_manager"),
        async (role) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "test@example.com",
            role,
            siteId: "site-1",
          });

          const result = await deleteCriteria("some-id");

          expect(result).toEqual({ success: false, error: "errors.forbidden" });
          expect(mockEvaluationCriteriaDelete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 6: Criteria creation round-trip

/**
 * Validates: Requirements 1.2
 */

describe("Property 6: Criteria creation round-trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createCriteria returns a record whose fields match the input for any valid criterion", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          titleAr: fc.string({ minLength: 1 }),
          descriptionAr: fc.option(fc.string()),
        }),
        async (input) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "admin@example.com",
            role: "super_admin",
            siteId: null,
          });

          const echoedRecord = {
            id: "criteria-id-1",
            titleAr: input.titleAr,
            descriptionAr: input.descriptionAr ?? null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          mockEvaluationCriteriaCreate.mockResolvedValueOnce(echoedRecord);

          const result = await createCriteria(input);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.titleAr).toBe(input.titleAr);
            expect(result.data.descriptionAr).toBe(input.descriptionAr ?? null);
            expect(result.data.isActive).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 7: listCriteria active-only filter

/**
 * Validates: Requirements 1.6
 */

describe("Property 7: listCriteria active-only filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCriteria(true) returns only records with isActive === true", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            isActive: fc.boolean(),
            titleAr: fc.string({ minLength: 1 }),
            id: fc.uuid(),
            descriptionAr: fc.option(fc.string()),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          })
        ),
        async (records) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "admin@example.com",
            role: "super_admin",
            siteId: null,
          });

          // Simulate Prisma filtering: when called with { where: { isActive: true } },
          // return only the active records (as Prisma would do in production)
          mockEvaluationCriteriaFindMany.mockImplementationOnce(
            (args: { where?: { isActive?: boolean } } | undefined) => {
              if (args?.where?.isActive === true) {
                return Promise.resolve(records.filter((r) => r.isActive === true));
              }
              return Promise.resolve(records);
            }
          );

          const result = await listCriteria(true);

          expect(result.success).toBe(true);
          if (result.success) {
            // Every returned record must have isActive === true
            expect(result.data.every((r) => r.isActive === true)).toBe(true);
            // The count must match the number of active records in the generated set
            const expectedActiveCount = records.filter((r) => r.isActive === true).length;
            expect(result.data.length).toBe(expectedActiveCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 8: createEvaluation RBAC — site isolation

/**
 * Validates: Requirements 4.2, 10.3, 10.4
 */

describe("Property 8: createEvaluation RBAC — site isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forbidden when site_security_manager evaluates an employee from a different site", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.uuid(), fc.uuid()).filter(([a, b]) => a !== b),
        async ([callerSiteId, employeeSiteId]) => {
          // Mock caller as site_security_manager with callerSiteId
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "manager@example.com",
            role: "site_security_manager",
            siteId: callerSiteId,
          });

          // Mock employee lookup to return a different siteId
          mockEmployeeFindUnique.mockResolvedValueOnce({ siteId: employeeSiteId });

          // Provide a valid evaluation payload (site mismatch should short-circuit before any mutation)
          const input = {
            employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            items: [
              {
                criteriaId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                score: "EXCELLENT",
              },
            ],
          };

          const result = await createEvaluation(input);

          expect(result).toEqual({ success: false, error: "errors.forbidden" });
          // No evaluation mutations should have been called
          expect(mockEmployeeEvaluationCreate).not.toHaveBeenCalled();
          expect(mockEmployeeEvaluationItemCreateMany).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 9: createEvaluation item count matches criteria count

/**
 * Validates: Requirements 4.1
 */

describe("Property 9: createEvaluation item count matches criteria count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists exactly N EmployeeEvaluationItem records when N items are submitted", async () => {
    // Arbitraries
    const evaluationItemArb = fc.record({
      criteriaId: fc.uuid(),
      score: fc.constantFrom(
        "EXCELLENT" as const,
        "VERY_GOOD" as const,
        "GOOD" as const,
        "ACCEPTABLE" as const
      ),
      notes: fc.option(fc.string(), { nil: undefined }),
    });

    const { prisma } = await import("@/lib/prisma");
    const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

    await fc.assert(
      fc.asyncProperty(
        fc.array(evaluationItemArb, { minLength: 1, maxLength: 20 }),
        async (items) => {
          // Mock caller as site_security_manager
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "manager@example.com",
            role: "site_security_manager",
            siteId: "site-abc",
          });

          // Mock employee lookup — same siteId so RBAC passes
          mockEmployeeFindUnique.mockResolvedValueOnce({ siteId: "site-abc" });

          // Track createMany call count
          let createManyItemCount = 0;

          const mockTx = {
            employeeEvaluation: {
              create: vi.fn().mockResolvedValue({
                id: "eval-id-1",
                employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                siteId: "site-abc",
                createdBy: "user-1",
                totalScore: 0,
                finalGrade: "Good",
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            },
            employeeEvaluationItem: {
              createMany: vi.fn().mockImplementation(
                (args: { data: unknown[] }) => {
                  createManyItemCount = args.data.length;
                  return Promise.resolve({ count: args.data.length });
                }
              ),
            },
          };

          // Mock $transaction to invoke the callback with the mock tx
          mockTransaction.mockImplementationOnce(
            async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
              return callback(mockTx);
            }
          );

          const input = {
            employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            items,
          };

          const result = await createEvaluation(input);

          expect(result.success).toBe(true);
          // The number of items passed to createMany must equal the input item count
          expect(createManyItemCount).toBe(items.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 10: Evaluation scores are recomputed on update

/**
 * Validates: Requirements 5.1
 */

describe("Property 10: Evaluation scores are recomputed on update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updated evaluation totalScore and finalGrade match calculateEvaluationScore output for any set of scores", async () => {
    const { prisma } = await import("@/lib/prisma");
    const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            "EXCELLENT" as const,
            "VERY_GOOD" as const,
            "GOOD" as const,
            "ACCEPTABLE" as const
          ),
          { minLength: 1 }
        ),
        async (scores) => {
          // Build items with a stable criteriaId
          const items = scores.map((score) => ({
            criteriaId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            score,
          }));

          // Compute expected values using the pure function
          const scoreResult = calculateEvaluationScore(items);
          expect(scoreResult.success).toBe(true);
          if (!scoreResult.success) return;
          const { totalScore: expectedTotalScore, finalGrade: expectedFinalGrade } =
            scoreResult.data;

          // Mock caller as super_admin (no site restrictions)
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "admin@example.com",
            role: "super_admin",
            siteId: null,
          });

          // Mock findUnique to return an existing evaluation
          mockEmployeeEvaluationFindUnique.mockResolvedValueOnce({
            id: "eval-id-1",
            siteId: "site-abc",
          });

          // Mock $transaction to invoke the callback with a mock tx
          const mockTx = {
            employeeEvaluationItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              createMany: vi.fn().mockResolvedValue({ count: items.length }),
            },
            employeeEvaluation: {
              update: vi.fn().mockResolvedValue({
                id: "eval-id-1",
                employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                siteId: "site-abc",
                createdBy: "user-1",
                totalScore: expectedTotalScore,
                finalGrade: expectedFinalGrade,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            },
          };

          mockTransaction.mockImplementationOnce(
            async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
              return callback(mockTx);
            }
          );

          const input = {
            employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            items,
          };

          const result = await updateEvaluation("eval-id-1", input);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.totalScore).toBe(expectedTotalScore);
            expect(result.data.finalGrade).toBe(expectedFinalGrade);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 11: getEmployeeEvaluations ordering invariant

/**
 * Validates: Requirements 6.1, 6.2, 9.5
 */

describe("Property 11: getEmployeeEvaluations ordering invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns evaluations ordered by createdAt descending for any set of records", async () => {
    // We need the findMany mock for employeeEvaluation — add it to the prisma mock
    const { prisma } = await import("@/lib/prisma");
    const mockFindMany = vi.fn();
    // Attach findMany to the mocked prisma.employeeEvaluation
    (prisma.employeeEvaluation as unknown as Record<string, unknown>).findMany = mockFindMany;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            employeeId: fc.uuid(),
            siteId: fc.uuid(),
            createdBy: fc.uuid(),
            totalScore: fc.float({ min: 2, max: 5 }),
            finalGrade: fc.option(fc.string()),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }),
          { minLength: 2 }
        ),
        async (records) => {
          // Mock caller as super_admin (no site restrictions)
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "admin@example.com",
            role: "super_admin",
            siteId: null,
          });

          // Mock employee lookup — employee exists
          mockEmployeeFindUnique.mockResolvedValueOnce({ siteId: "site-abc" });

          // Simulate Prisma ordering: sort by createdAt desc
          const sorted = [...records].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );
          mockFindMany.mockResolvedValueOnce(sorted);

          const result = await (await import("../evaluations")).getEmployeeEvaluations(
            records[0].employeeId
          );

          expect(result.success).toBe(true);
          if (result.success) {
            // Verify ordering: each record's createdAt >= the next one's
            for (let i = 0; i < result.data.length - 1; i++) {
              expect(result.data[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                result.data[i + 1].createdAt.getTime()
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 12: Invalid score values are rejected

/**
 * Validates: Requirements 2.3, 4.4
 */

describe("Property 12: Invalid score values are rejected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createEvaluation returns invalidInput for any score string not in the valid enum set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(
          (s) => !["EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE"].includes(s)
        ),
        async (invalidScore) => {
          mockGetServerUser.mockResolvedValueOnce({
            id: "user-1",
            email: "admin@example.com",
            role: "super_admin",
            siteId: null,
          });

          const input = {
            employeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            items: [
              {
                criteriaId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                score: invalidScore,
              },
            ],
          };

          const result = await createEvaluation(input);

          expect(result).toEqual({ success: false, error: "errors.invalidInput" });
          // No Prisma mutations should have been called
          expect(mockEmployeeEvaluationCreate).not.toHaveBeenCalled();
          expect(mockEmployeeEvaluationItemCreateMany).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 13: Unauthenticated requests are redirected

/**
 * Validates: Requirements 10.2
 */

describe("Property 13: Unauthenticated requests are redirected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("all exported functions propagate the redirect and do not call Prisma mutations when getServerUser throws", async () => {
    const {
      createCriteria: _createCriteria,
      updateCriteria: _updateCriteria,
      deleteCriteria: _deleteCriteria,
      listCriteria: _listCriteria,
      createEvaluation: _createEvaluation,
      updateEvaluation: _updateEvaluation,
      getEmployeeEvaluations: _getEmployeeEvaluations,
      getEvaluationById: _getEvaluationById,
    } = await import("../evaluations");

    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        async (anyInput) => {
          // Reset all mocks before each iteration
          vi.clearAllMocks();

          // Make getServerUser throw a redirect for every call
          mockGetServerUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

          // Test createCriteria
          try {
            await _createCriteria(anyInput);
            // Should not reach here
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEvaluationCriteriaCreate).not.toHaveBeenCalled();

          // Test updateCriteria
          try {
            await _updateCriteria("some-id", anyInput);
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEvaluationCriteriaUpdate).not.toHaveBeenCalled();

          // Test deleteCriteria
          try {
            await _deleteCriteria("some-id");
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEvaluationCriteriaDelete).not.toHaveBeenCalled();

          // Test listCriteria
          try {
            await _listCriteria();
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEvaluationCriteriaFindMany).not.toHaveBeenCalled();

          // Test createEvaluation
          try {
            await _createEvaluation(anyInput);
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEmployeeEvaluationCreate).not.toHaveBeenCalled();
          expect(mockEmployeeEvaluationItemCreateMany).not.toHaveBeenCalled();

          // Test updateEvaluation
          try {
            await _updateEvaluation("some-id", anyInput);
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEmployeeEvaluationUpdate).not.toHaveBeenCalled();
          expect(mockEmployeeEvaluationItemDeleteMany).not.toHaveBeenCalled();

          // Test getEmployeeEvaluations
          try {
            await _getEmployeeEvaluations("some-employee-id");
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
          expect(mockEmployeeFindUnique).not.toHaveBeenCalled();

          // Test getEvaluationById
          try {
            await _getEvaluationById("some-eval-id");
            expect(true).toBe(false);
          } catch (err) {
            expect((err as Error).message).toBe("NEXT_REDIRECT");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
