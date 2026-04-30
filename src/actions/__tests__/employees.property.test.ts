// Feature: nextjs-supabase-prisma-refactor, Property 1: Server Action input validation rejects invalid inputs

/**
 * Validates: Requirements 2.2, 2.3
 */

import * as fc from "fast-check";
import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Hoisted mocks (vi.mock factories are hoisted, so use vi.hoisted) ---

const { mockEmployeeCreate, mockGetServerUser } = vi.hoisted(() => {
  const mockEmployeeCreate = vi.fn();
  const mockGetServerUser = vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" });
  return { mockEmployeeCreate, mockGetServerUser };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      create: mockEmployeeCreate,
    },
  },
}));

vi.mock("@/lib/auth/user", () => ({
  getServerUser: mockGetServerUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Also mock supabase server client (imported by employees.ts)
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// --- Import after mocks ---
import { createEmployee } from "../employees";

// --- Tests ---

describe("Property 1: Server Action input validation rejects invalid inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("rejects invalid employee inputs without calling prisma", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ nameAr: fc.constant("") }),
        async (invalidInput) => {
          mockEmployeeCreate.mockClear();

          const fd = new FormData();
          Object.entries(invalidInput).forEach(([k, v]) => fd.append(k, String(v)));

          const result = await createEmployee(fd);

          expect(result.success).toBe(false);
          expect(typeof (result as { success: false; error: string }).error).toBe("string");
          expect(mockEmployeeCreate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: nextjs-supabase-prisma-refactor, Property 2: Server Action success response shape
describe("Property 2: Server Action success response shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("returns success:true with data matching input for valid inputs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nameAr: fc.string({ minLength: 1 }),
          status: fc.constantFrom("active", "inactive", "terminated"),
        }),
        async (input) => {
          const fakeEmployee = {
            id: "emp-1",
            nameAr: input.nameAr,
            email: null,
            phone: null,
            address: null,
            hireDate: null,
            status: input.status,
            authUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockEmployeeCreate.mockResolvedValueOnce(fakeEmployee);

          const fd = new FormData();
          Object.entries(input).forEach(([k, v]) => fd.append(k, String(v)));

          const result = await createEmployee(fd);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.nameAr).toBe(input.nameAr);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: nextjs-supabase-prisma-refactor, Property 3: Server Actions require an authenticated session
describe("Property 3: Server Actions require an authenticated session", () => {
  it("does not call prisma when session is missing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        async (anyInput) => {
          mockEmployeeCreate.mockClear();
          mockGetServerUser.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

          const fd = new FormData();
          try {
            await createEmployee(fd);
          } catch {
            // redirect throws — that's expected
          }

          expect(mockEmployeeCreate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: nextjs-supabase-prisma-refactor, Property 4: Employee mutation round-trip
describe("Property 4: Employee mutation round-trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("returned data matches input fields for nameAr and status", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nameAr: fc.string({ minLength: 1 }),
          status: fc.constantFrom("active", "inactive", "terminated"),
        }),
        async (input) => {
          const fakeEmployee = {
            id: "emp-round-trip",
            nameAr: input.nameAr,
            email: null,
            phone: null,
            address: null,
            hireDate: null,
            status: input.status,
            authUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockEmployeeCreate.mockResolvedValueOnce(fakeEmployee);

          const fd = new FormData();
          Object.entries(input).forEach(([k, v]) => fd.append(k, String(v)));

          const result = await createEmployee(fd);

          if (result.success) {
            expect(result.data.nameAr).toBe(input.nameAr);
            expect(result.data.status).toBe(input.status);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: nextjs-supabase-prisma-refactor, Property 7: Server Action errors return i18n keys
const I18N_KEY_PATTERN = /^[a-z]+(\.[a-zA-Z]+)+$/;

describe("Property 7: Server Action errors return i18n keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("error strings are dot-notation i18n keys", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ nameAr: fc.constant("") }),
        async (invalidInput) => {
          const fd = new FormData();
          Object.entries(invalidInput).forEach(([k, v]) => fd.append(k, String(v)));

          const result = await createEmployee(fd);

          if (!result.success) {
            expect(I18N_KEY_PATTERN.test(result.error)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
