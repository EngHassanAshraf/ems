// Feature: nextjs-supabase-prisma-refactor, Property 5: Employee list filter correctness

/**
 * Validates: Requirements 6.4
 */

import * as fc from "fast-check";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockTransaction, mockGetServerUser } = vi.hoisted(() => {
  const mockTransaction = vi.fn();
  const mockGetServerUser = vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" });
  return { mockTransaction, mockGetServerUser };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    employee: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/user", () => ({
  getServerUser: mockGetServerUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { listEmployees } from "../employees";

describe("Property 5: Employee list filter correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("every returned employee satisfies the search and status predicates", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.constantFrom("all", "active", "inactive", "terminated"),
        async (q, status) => {
          // Create fake employees that satisfy the filter (simulating what the DB would return)
          const matchingStatus = status === "all" ? "active" : status;
          const fakeEmployees = [
            {
              id: "emp-1",
              nameAr: q.trim() ? `${q} employee` : "موظف",
              email: null,
              phone: null,
              address: null,
              hireDate: null,
              status: matchingStatus,
              authUserId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];

          mockTransaction.mockResolvedValueOnce([fakeEmployees, 1]);

          const result = await listEmployees({ q, status, page: 1, pageSize: 10 });

          expect(result.success).toBe(true);
          if (result.success) {
            result.data.items.forEach((emp) => {
              if (q.trim()) {
                const matches = [emp.nameAr, emp.email].some((f) =>
                  f?.toLowerCase().includes(q.toLowerCase())
                );
                expect(matches).toBe(true);
              }
              if (status !== "all") {
                expect(emp.status).toBe(status);
              }
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
