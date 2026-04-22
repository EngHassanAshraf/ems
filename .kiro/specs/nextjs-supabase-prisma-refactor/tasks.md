# Implementation Plan: Next.js + Supabase + Prisma Refactor

## Overview

Incrementally migrate the app from client-side React Query + Supabase JS to a server-first architecture with Prisma ORM and Next.js Server Actions. Each task builds on the previous one and ends with all code wired together. The migration follows the 10-step order from the design document.

## Tasks

- [x] 1. Install dependencies and configure Prisma
  - Install `prisma` and `@prisma/client` as dependencies
  - Add `"postinstall": "prisma generate"` to `package.json` scripts and update `build` to `"prisma generate && next build"`
  - Create `prisma/schema.prisma` with `generator client`, `datasource db` (postgresql, DATABASE_URL, directUrl = DIRECT_URL), enums `EmployeeStatus` and `DocumentType`, and models `UserProfile`, `Employee`, `Document`, `AttendanceEvent`, `LeaveRequest` with all `@@map` annotations and `onDelete: Cascade` relations as specified in the design
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1, 11.4_

- [x] 2. Create database migration for schema simplification
  - Create `supabase/migrations/0006_simplify_schema.sql` with the full SQL from the design: drop multi-tenant tables (`company_memberships`, `departments`, `positions`, `companies`, `roles`), drop RLS helper functions, drop multi-tenant columns from `employees`, `documents`, `attendance_events`, `leave_requests`, replace all RLS policies with `auth.uid() IS NOT NULL` policies, and replace `handle_new_user` trigger to only insert a `user_profiles` row
  - _Requirements: 1.1, 4.1, 3.2_

- [x] 3. Set up server infrastructure
  - [x] 3.1 Create `src/lib/prisma.ts` — Prisma singleton using the `globalThis` hot-reload pattern with dev-mode query logging
    - _Requirements: 1.5, 10.5_

  - [x] 3.2 Create `src/lib/auth/user.ts` — export `getServerUser()` that calls `supabase.auth.getUser()`, detects locale from the `x-pathname` header, and calls `redirect(`/${locale}/login`)` if no valid session
    - _Requirements: 4.4, 3.6_

  - [x] 3.3 Update `src/lib/env.ts` — add `serverSchema` with `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; export `serverEnv` validated only when `typeof window === "undefined"`; throw descriptive errors on missing variables
    - _Requirements: 1.6, 10.2, 10.4_

  - [x] 3.4 Update `.env.example` — add `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with inline comments describing each variable's purpose
    - _Requirements: 10.1_

  - [x] 3.5 Create `src/actions/types.ts` — export `ActionResult<T>` as `{ success: true; data: T } | { success: false; error: string }`
    - _Requirements: 2.3, 2.4_

- [x] 4. Implement auth Server Actions
  - Create `src/actions/auth.ts` with `"use server"` directive and three exported functions:
    - `signIn(input)` — Zod-validate `{ email, password }`, call `supabase.auth.signInWithPassword`, on success `redirect` to `/${locale}/dashboard`, on failure return `{ success: false, error: "auth.invalidCredentials" }`
    - `signUp(input)` — Zod-validate `{ email, password, fullName }`, call `supabase.auth.signUp` with `options.data.full_name`, return `{ success: true, data: null }` on success
    - `signOut(locale)` — call `supabase.auth.signOut`, then `redirect(`/${locale}/login`)`
  - _Requirements: 3.2, 3.3, 3.4, 2.6_

- [x] 5. Implement employee Server Actions
  - Create `src/actions/employees.ts` with `"use server"` directive:
    - `createEmployee(input)` — `getServerUser`, Zod-validate, `prisma.employee.create`, `revalidatePath`, return `ActionResult<Employee>`
    - `updateEmployee(id, input)` — `getServerUser`, Zod-validate, `prisma.employee.update`, `revalidatePath`, return `ActionResult<Employee>`; return `errors.notFound` on Prisma P2025
    - `deleteEmployee(id)` — `getServerUser`, `prisma.document.findMany` for the employee, remove all files from Supabase Storage, `prisma.employee.delete` (cascade removes documents), `revalidatePath`, return `ActionResult<null>`
    - `listEmployees(params)` — `getServerUser`, `prisma.$transaction([findMany, count])` with `where` clause for search (`nameAr`, `nameEn`, `email` contains) and status filter, `orderBy: { createdAt: "desc" }`, `skip`/`take` for pagination, return `{ items, total }`
    - `getEmployeeStats()` — `getServerUser`, `prisma.employee.groupBy({ by: ["status"], _count: true })`, map to `{ total, active, inactive, terminated }`, return `ActionResult`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 6.1, 6.2, 6.3, 6.4, 6.5, 8.2_

  - [x] 5.1 Write property test for employee Server Action input validation (Property 1)
    - **Property 1: Server Action input validation rejects invalid inputs**
    - Mock `prisma.employee.create` and `getServerUser`; use `fc.record({ nameAr: fc.constant("") })` as invalid input; assert `result.success === false` and `mockPrisma.employee.create` was not called
    - **Validates: Requirements 2.2, 2.3**

  - [x] 5.2 Write property test for employee Server Action success response shape (Property 2)
    - **Property 2: Server Action success response shape**
    - Use `fc.record({ nameAr: fc.string({ minLength: 1 }), status: fc.constantFrom("active","inactive","terminated") })` as valid input; assert `result.success === true` and `result.data.nameAr === input.nameAr`
    - **Validates: Requirements 2.4**

  - [x] 5.3 Write property test for session guard on employee actions (Property 3)
    - **Property 3: Server Actions require an authenticated session**
    - Mock `getServerUser` to throw a redirect error; call `createEmployee` with `fc.anything()`; assert `mockPrisma.employee.create` was never called
    - **Validates: Requirements 4.3**

  - [x] 5.4 Write property test for employee mutation round-trip (Property 4)
    - **Property 4: Employee mutation round-trip**
    - Use `fc.record({ nameAr: fc.string({ minLength: 1 }), status: fc.constantFrom("active","inactive","terminated") })`; call `createEmployee`; assert returned `data.nameAr`, `data.status` match input
    - **Validates: Requirements 6.1, 6.2**

  - [x] 5.5 Write property test for employee list filter correctness (Property 5)
    - **Property 5: Employee list filter correctness**
    - Use `fc.string()` and `fc.constantFrom("all","active","inactive","terminated")`; call `listEmployees`; assert every returned employee satisfies the search and status predicates
    - **Validates: Requirements 6.4**

  - [x] 5.6 Write property test for i18n error keys on employee actions (Property 7)
    - **Property 7: Server Action errors return i18n keys**
    - Use `fc.record({ nameAr: fc.constant("") })` to trigger validation failure; assert `result.error` matches `/^[a-z]+(\.[a-zA-Z]+)+$/`
    - **Validates: Requirements 9.2**

- [x] 6. Implement document Server Actions
  - Create `src/actions/documents.ts` with `"use server"` directive:
    - `uploadDocument(metadata, file)` — `getServerUser`, Zod-validate `{ employeeId, type, title?, description? }`, `prisma.document.create` with `storagePath: "pending"`, `supabaseServerClient.storage.upload` to `employee/{employeeId}/document/{docId}/v1/{filename}`; on upload failure delete the DB row and return `{ success: false, error: "errors.uploadFailed" }`; on success `prisma.document.update` with real `storagePath`, `revalidatePath`, return `ActionResult<Document>`
    - `deleteDocument(id)` — `getServerUser`, `prisma.document.findUnique`, `storage.remove`, `prisma.document.delete`, `revalidatePath`, return `ActionResult<null>`
    - `getSignedUrl(id)` — `getServerUser`, `prisma.document.findUnique`, `createSignedUrl(300)`, return `ActionResult<{ url: string }>`
    - `listDocuments(employeeId)` — `getServerUser`, `prisma.document.findMany({ where: { employeeId }, orderBy: { uploadedAt: "desc" } })`, return `ActionResult<Document[]>`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 6.1 Write property test for document list ordering invariant (Property 6)
    - **Property 6: Document list ordering invariant**
    - Use `fc.uuid()` as `employeeId`; mock `prisma.document.findMany` to return shuffled docs; call `listDocuments`; assert every adjacent pair satisfies `docs[i].uploadedAt >= docs[i+1].uploadedAt`
    - **Validates: Requirements 7.5**

- [x] 7. Checkpoint — verify server infrastructure compiles
  - Run `npx tsc --noEmit` to confirm `src/lib/prisma.ts`, `src/lib/auth/user.ts`, `src/lib/env.ts`, `src/actions/auth.ts`, `src/actions/employees.ts`, `src/actions/documents.ts` have no TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update auth forms and app layout
  - [x] 8.1 Update `src/features/auth/login-form.tsx` — replace direct `supabase.auth.signInWithPassword` call with `import { signIn } from "@/actions/auth"` and call it via `useTransition`; handle `ActionResult` to show error toast on failure
    - _Requirements: 3.3_

  - [x] 8.2 Update `src/features/auth/signup-form.tsx` — replace direct `supabase.auth.signUp` call with `import { signUp } from "@/actions/auth"`; pass `fullName` field; handle `ActionResult`
    - _Requirements: 3.2_

  - [x] 8.3 Update `src/app/[locale]/(app)/layout.tsx` — convert to async Server Component; call `getServerUser()` at the top as the auth guard; remove any `RequireAuth` wrapper
    - _Requirements: 4.4, 5.1_

  - [x] 8.4 Delete `src/features/auth/auth-context.tsx`, `src/features/auth/use-membership.ts`, and `src/components/auth/require-auth.tsx` — these are replaced by server-side auth; remove all import references from other files
    - _Requirements: 3.6, 5.3_

- [x] 9. Convert pages to Server Components
  - [x] 9.1 Convert `src/app/[locale]/(app)/dashboard/page.tsx` — remove `"use client"`, make it an `async` function, call `getEmployeeStats()` directly, render `StatCard` components with the result; wrap in `<Suspense>` with a skeleton fallback; add `src/app/[locale]/(app)/dashboard/error.tsx` boundary
    - _Requirements: 5.1, 5.2, 5.5, 8.1, 8.2, 8.3_

  - [x] 9.2 Convert `src/app/[locale]/(app)/employees/page.tsx` — remove `"use client"`, make it `async`, read `searchParams` prop for `q`, `status`, `page`, call `listEmployees(params)`, pass `employees` and `total` as props to `EmployeesTable`; wrap in `<Suspense>`; add `error.tsx` boundary
    - _Requirements: 5.1, 5.2, 5.4, 6.4_

  - [x] 9.3 Convert `src/app/[locale]/(app)/employees/[id]/page.tsx` — remove `"use client"`, make it `async`, call `prisma.employee.findUnique({ where: { id: params.id }, include: { documents: true } })`, call `notFound()` if null, pass employee to a detail view component; wrap in `<Suspense>`; add `error.tsx` boundary
    - _Requirements: 5.1, 5.2, 5.5, 6.7_

  - [x] 9.4 Convert `src/app/[locale]/(app)/documents/page.tsx` — remove `"use client"`, make it `async`, call `listDocuments(employeeId)` (or read `employeeId` from `searchParams`), pass docs as props to `DocumentsList`; wrap in `<Suspense>`; add `error.tsx` boundary
    - _Requirements: 5.1, 5.2, 5.4, 7.5_

- [x] 10. Update client components to use Server Actions
  - [x] 10.1 Update `src/features/employees/employee-form.tsx` — remove `useMembership`, `useQueryClient`, `listDepartments`, `listPositions`, and `@/data/employees` imports; import `createEmployee` and `updateEmployee` from `@/actions/employees`; call them via `useTransition`; remove `department_id` and `position_id` fields (dropped from schema); handle `ActionResult` for toast feedback
    - _Requirements: 6.1, 6.2, 2.2_

  - [x] 10.2 Update `src/features/employees/delete-employee-dialog.tsx` — remove `useMutation` and `@/data/employees` imports; import `deleteEmployee` from `@/actions/employees`; call it via `useTransition`; handle `ActionResult` for toast feedback
    - _Requirements: 6.3_

  - [x] 10.3 Update `src/features/employees/employees-table.tsx` — remove `isLoading` prop and any internal React Query usage; accept `employees` as a required prop; remove `Spinner` loading state (loading is handled by Suspense in the parent Server Component)
    - _Requirements: 5.4, 6.6_

  - [x] 10.4 Update `src/features/documents/document-upload-form.tsx` — remove `companyId` prop (no longer needed), `useQueryClient`, and `@/data/documents` imports; import `uploadDocument` from `@/actions/documents`; call it via `useTransition` passing `FormData` or structured args; handle `ActionResult` for toast feedback
    - _Requirements: 7.1, 7.2_

  - [x] 10.5 Update `src/features/documents/documents-list.tsx` — remove internal data fetching; accept `documents` as a required prop; call `getSignedUrl` Server Action on demand when user clicks a document link; handle `ActionResult` to open the signed URL
    - _Requirements: 5.4, 7.3, 7.5_

- [x] 11. Clean up legacy data layer
  - Delete `src/data/employees.ts`, `src/data/documents.ts`, `src/data/departments.ts`, `src/data/positions.ts`, and `src/data/queryKeys.ts`
  - Remove `ReactQueryProvider` wrapper from `src/app/[locale]/layout.tsx` if React Query is no longer used anywhere (or keep it only if optimistic updates remain)
  - _Requirements: 5.3_

- [x] 12. Final checkpoint — verify full build
  - Run `npx prisma generate` to confirm the schema is valid and the Prisma Client generates without errors
  - Run `npx tsc --noEmit` to confirm zero TypeScript errors across the entire project
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 11.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` and should be tagged with `// Feature: nextjs-supabase-prisma-refactor, Property N: <text>`
- Each property test runs a minimum of 100 iterations
- The migration order (1 → 12) is intentional — infrastructure before actions, actions before pages, pages before client component updates
- `middleware.ts` is not modified — it already handles session refresh and auth redirects correctly
- Prisma Client must never be imported in any `"use client"` file
