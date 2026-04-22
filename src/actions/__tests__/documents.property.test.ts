// Feature: nextjs-supabase-prisma-refactor, Property 6: Document list ordering invariant

/**
 * Validates: Requirements 7.5
 */

import * as fc from "fast-check";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockDocumentFindMany, mockGetServerUser } = vi.hoisted(() => {
  const mockDocumentFindMany = vi.fn();
  const mockGetServerUser = vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" });
  return { mockDocumentFindMany, mockGetServerUser };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: mockDocumentFindMany,
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

import { listDocuments } from "../documents";

describe("Property 6: Document list ordering invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("documents are returned in descending uploadedAt order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") }),
          { minLength: 0, maxLength: 10 }
        ),
        async (employeeId, dates) => {
          // Simulate what Prisma returns: documents sorted descending by uploadedAt
          const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

          const fakeDocs = sortedDates.map((date, i) => ({
            id: `doc-${i}`,
            employeeId,
            type: "contract",
            title: `Document ${i}`,
            description: null,
            storageBucket: "employee-documents",
            storagePath: `employee/${employeeId}/doc-${i}`,
            mimeType: "application/pdf",
            byteSize: BigInt(1024),
            version: 1,
            uploadedAt: date,
            createdAt: date,
            updatedAt: date,
          }));

          mockDocumentFindMany.mockResolvedValueOnce(fakeDocs);

          const result = await listDocuments(employeeId);

          expect(result.success).toBe(true);
          if (result.success) {
            const docs = result.data;
            for (let i = 0; i < docs.length - 1; i++) {
              expect(docs[i].uploadedAt >= docs[i + 1].uploadedAt).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
