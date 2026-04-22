# Design Document: Next.js + Supabase + Prisma Refactor

## Overview

This document describes the technical design for refactoring the existing Next.js + Supabase employee management application. The refactor has three primary goals:

1. **Introduce Prisma ORM** as the type-safe data layer, replacing raw Supabase JS client calls for all data queries and mutations.
2. **Move all mutations to Server Actions**, eliminating any client-side exposure of database credentials or business logic.
3. **Convert pages to Server Components**, replacing the current React Query + client-side fetching pattern with server-first rendering.

The application is a single-organisation, Arabic-first internal HR system. There is no multi-tenancy, no RBAC, and no department/position hierarchy in the target schema. All authenticated users have full access.

The existing Supabase infrastructure (Auth, Storage, Postgres) remains unchanged. Supabase migrations remain the schema source of truth — Prisma is used only as a query layer, not for schema management.

### Key Constraints

- `DATABASE_URL` is a server-only secret; never prefixed with `NEXT_PUBLIC_`.
- Prisma Client is never imported in `"use client"` files.
- `middleware.ts` is kept as-is — it already correctly handles session refresh and auth redirects.
- `next-intl` routing and configuration are preserved without modification.
- The `EmployeeStatusBadge` and `StatCard` component interfaces are not modified.

---

## Architecture

### Before (Current State)

```
Browser
  └── Client Components ("use client")
        ├── React Query hooks
        ├── src/data/employees.ts  ← calls supabase client directly
        ├── src/data/documents.ts  ← calls supabase client directly
        └── src/features/auth/auth-context.tsx  ← useEffect + getSession()
```

### After (Target State)

```
Browser
  └── Client Components ("use client")
        ├── Forms (react-hook-form + zod)
        ├── Interactive UI (dialogs, pagination state)
        └── Server Action callers (useTransition / form actions)

Next.js Server
  ├── Server Components (pages)  ← fetch via Prisma directly
  ├── Server Actions (src/actions/)  ← validate → auth check → Prisma → revalidate
  ├── src/lib/prisma.ts  ← Prisma singleton
  ├── src/lib/auth/user.ts  ← getServerUser()
  └── src/lib/supabase/server.ts  ← createSupabaseServerClient() (kept)

Supabase
  ├── Auth (session cookies via @supabase/ssr)
  ├── Postgres (accessed via Prisma over DATABASE_URL)
  ├── Storage (accessed via Supabase server client in Server Actions)
  └── RLS (auth.uid() IS NOT NULL on all tables)
```

### Request Lifecycle — Employee List Page

```
1. Browser → GET /ar/employees
2. middleware.ts: refresh session cookie, verify user, pass through
3. Server Component (employees/page.tsx):
     a. getServerUser() → verify session or redirect
     b. prisma.employee.findMany({ where, orderBy, skip, take })
     c. render HTML with data
4. HTML streamed to browser (no client-side fetch needed)
5. User clicks "Edit" → Client Component opens dialog
6. User submits form → Server Action (updateEmployee)
     a. getServerUser() → verify session
     b. zod.parse(input)
     c. prisma.employee.update(...)
     d. revalidatePath('/[locale]/employees')
     e. return { success: true, data: employee }
7. Client Component receives result, closes dialog
   (Next.js revalidation causes page to re-render with fresh data)
```

### Request Lifecycle — Document Upload

```
1. Client Component: user selects file, fills metadata
2. File is uploaded via Server Action (uploadDocument):
     a. getServerUser() → verify session
     b. zod.parse(metadata)
     c. prisma.document.create({ data: { ...meta, storage_path: 'pending' } })
     d. supabaseServerClient.storage.upload(path, file)
        → if fails: prisma.document.delete({ where: { id } }), return error
     e. prisma.document.update({ where: { id }, data: { storage_path } })
     f. revalidatePath('/[locale]/employees/[id]')
     g. return { success: true, data: document }
```

---

## Components and Interfaces

### Folder Structure (post-refactor)

```
src/
├── actions/
│   ├── auth.ts          # signIn, signUp, signOut
│   ├── employees.ts     # createEmployee, updateEmployee, deleteEmployee
│   └── documents.ts     # uploadDocument, deleteDocument, getSignedUrl
├── app/
│   └── [locale]/
│       ├── (app)/
│       │   ├── dashboard/page.tsx        # Server Component
│       │   ├── employees/
│       │   │   ├── page.tsx              # Server Component
│       │   │   └── [id]/page.tsx         # Server Component
│       │   ├── documents/page.tsx        # Server Component
│       │   └── layout.tsx               # Server Component (auth guard)
│       ├── (auth)/
│       │   ├── login/page.tsx
│       │   └── signup/page.tsx
│       └── layout.tsx
├── components/
│   ├── auth/require-auth.tsx            # removed (replaced by server-side guard)
│   └── ui/                              # unchanged
├── features/
│   ├── auth/
│   │   ├── login-form.tsx               # updated: calls signIn Server Action
│   │   └── signup-form.tsx              # updated: calls signUp Server Action
│   ├── dashboard/
│   │   └── stat-card.tsx                # unchanged
│   ├── documents/
│   │   ├── document-upload-form.tsx     # updated: calls uploadDocument Server Action
│   │   └── documents-list.tsx           # updated: receives docs as props
│   └── employees/
│       ├── delete-employee-dialog.tsx   # updated: calls deleteEmployee Server Action
│       ├── employee-form.tsx            # updated: calls create/update Server Actions
│       ├── employee-status-badge.tsx    # unchanged
│       └── employees-table.tsx          # updated: receives employees as props
├── i18n/                                # unchanged
├── lib/
│   ├── auth/
│   │   └── user.ts                      # NEW: getServerUser()
│   ├── env.ts                           # updated: adds server-side vars
│   ├── prisma.ts                        # NEW: Prisma singleton
│   ├── react-query/provider.tsx         # kept (for optimistic updates)
│   ├── supabase/
│   │   ├── client.ts                    # kept (auth forms still need it)
│   │   ├── middleware.ts                # unchanged
│   │   └── server.ts                    # unchanged
│   ├── theme/provider.tsx               # unchanged
│   └── utils.ts                         # unchanged
└── styles/                              # unchanged

prisma/
└── schema.prisma                        # NEW

supabase/
└── migrations/
    ├── 0001_init_schema.sql             # existing
    ├── 0002_indexes_search.sql          # existing
    ├── 0003_rls_policies.sql            # existing
    ├── 0004_storage_buckets.sql         # existing
    ├── 0005_auto_provision_user.sql     # existing
    └── 0006_simplify_schema.sql         # NEW: drops multi-tenant tables, simplifies schema
```

### Client Components (kept as "use client")

These components remain client-side because they require browser interactivity:

| Component | Reason |
|---|---|
| `login-form.tsx` | `react-hook-form`, `useRouter`, `useSearchParams` |
| `signup-form.tsx` | `react-hook-form`, `useRouter` |
| `employee-form.tsx` | `react-hook-form`, controlled inputs |
| `delete-employee-dialog.tsx` | Dialog open/close state, confirmation interaction |
| `document-upload-form.tsx` | File input, `react-hook-form` |
| `employees-table.tsx` | Sort/filter UI state (if any), click handlers |
| `documents-list.tsx` | Signed URL fetching on demand |
| All `src/components/ui/` | Interactive primitives (dialog, toast, etc.) |

### Server Components (converted from client)

| Component | Data Source |
|---|---|
| `dashboard/page.tsx` | `prisma.employee.groupBy(...)` |
| `employees/page.tsx` | `prisma.employee.findMany(...)` with search params |
| `employees/[id]/page.tsx` | `prisma.employee.findUnique(...)` |
| `documents/page.tsx` | `prisma.document.findMany(...)` |
| `(app)/layout.tsx` | `getServerUser()` for auth guard |

---

## Data Models

### New Supabase Migration: `0006_simplify_schema.sql`

This migration drops the multi-tenant tables and simplifies the schema to a single-organisation model. It also replaces the complex RBAC RLS policies with simple `auth.uid() IS NOT NULL` policies, and simplifies the `handle_new_user` trigger.

```sql
-- 0006_simplify_schema.sql
-- Simplify to single-org schema: drop multi-tenant tables, simplify RLS,
-- simplify handle_new_user trigger, remove company_id from core tables.
begin;

-- -----------------------------------------------------------------------
-- 1. Drop multi-tenant tables (cascade removes FK constraints automatically)
-- -----------------------------------------------------------------------
drop table if exists public.company_memberships cascade;
drop table if exists public.departments cascade;
drop table if exists public.positions cascade;
drop table if exists public.companies cascade;
drop table if exists public.roles cascade;

-- -----------------------------------------------------------------------
-- 2. Drop old RLS helper functions (no longer needed)
-- -----------------------------------------------------------------------
drop function if exists public.is_company_member(uuid);
drop function if exists public.has_company_role(uuid, text);
drop function if exists public.is_hr_or_admin(uuid);

-- -----------------------------------------------------------------------
-- 3. Simplify employees table: drop multi-tenant columns
-- -----------------------------------------------------------------------
alter table public.employees
  drop column if exists company_id,
  drop column if exists department_id,
  drop column if exists position_id,
  drop column if exists created_by,
  drop column if exists updated_by;

-- -----------------------------------------------------------------------
-- 4. Simplify documents table: drop multi-tenant columns
-- -----------------------------------------------------------------------
alter table public.documents
  drop column if exists company_id,
  drop column if exists supersedes_document_id,
  drop column if exists checksum_sha256,
  drop column if exists created_by,
  drop column if exists updated_by;

-- -----------------------------------------------------------------------
-- 5. Simplify attendance_events and leave_requests: drop company_id
-- -----------------------------------------------------------------------
alter table public.attendance_events
  drop column if exists company_id;

alter table public.leave_requests
  drop column if exists company_id;

-- -----------------------------------------------------------------------
-- 6. Drop old RLS policies and replace with simple auth.uid() IS NOT NULL
-- -----------------------------------------------------------------------

-- user_profiles
drop policy if exists user_profiles_self_select on public.user_profiles;
drop policy if exists user_profiles_self_update on public.user_profiles;
drop policy if exists user_profiles_self_insert on public.user_profiles;

create policy user_profiles_authenticated_select
  on public.user_profiles for select
  to authenticated using (auth.uid() is not null);

create policy user_profiles_authenticated_insert
  on public.user_profiles for insert
  to authenticated with check (auth.uid() is not null);

create policy user_profiles_authenticated_update
  on public.user_profiles for update
  to authenticated using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- employees
drop policy if exists employees_crud_hr_admin on public.employees;
drop policy if exists employees_select_self on public.employees;

create policy employees_authenticated_all
  on public.employees for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- documents
drop policy if exists documents_crud_hr_admin on public.documents;
drop policy if exists documents_select_self on public.documents;

create policy documents_authenticated_all
  on public.documents for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- attendance_events
drop policy if exists attendance_events_crud_hr_admin on public.attendance_events;

create policy attendance_events_authenticated_all
  on public.attendance_events for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- leave_requests
drop policy if exists leave_requests_crud_hr_admin on public.leave_requests;

create policy leave_requests_authenticated_all
  on public.leave_requests for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- -----------------------------------------------------------------------
-- 7. Simplify handle_new_user trigger: only create user_profile
-- -----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.user_profiles (id, full_name_en, email, is_active)
  values (new.id, v_full_name, new.email, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recreate trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
```

### Prisma Schema: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum EmployeeStatus {
  active
  inactive
  terminated

  @@map("employee_status")
}

enum DocumentType {
  introduction
  contract
  attachment

  @@map("document_type")
}

model UserProfile {
  id         String   @id @db.Uuid
  fullNameAr String?  @map("full_name_ar")
  fullNameEn String?  @map("full_name_en")
  phone      String?
  email      String?
  avatarUrl  String?  @map("avatar_url")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("user_profiles")
}

model Employee {
  id         String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  authUserId String?        @unique @map("auth_user_id") @db.Uuid
  nameAr     String         @map("name_ar")
  nameEn     String?        @map("name_en")
  email      String?
  phone      String?
  address    String?
  hireDate   DateTime?      @map("hire_date") @db.Date
  status     EmployeeStatus @default(active)
  createdAt  DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  documents        Document[]
  attendanceEvents AttendanceEvent[]
  leaveRequests    LeaveRequest[]

  @@map("employees")
}

model Document {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId    String       @map("employee_id") @db.Uuid
  type          DocumentType
  title         String?
  description   String?
  storageBucket String       @default("employee-documents") @map("storage_bucket")
  storagePath   String       @map("storage_path")
  mimeType      String?      @map("mime_type")
  byteSize      BigInt?      @map("byte_size")
  version       Int          @default(1)
  uploadedAt    DateTime     @default(now()) @map("uploaded_at") @db.Timestamptz
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("documents")
}

model AttendanceEvent {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  eventType  String   @map("event_type")
  occurredAt DateTime @map("occurred_at") @db.Timestamptz
  source     String?
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("attendance_events")
}

model LeaveRequest {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  leaveType  String   @map("leave_type")
  startDate  DateTime @map("start_date") @db.Date
  endDate    DateTime @map("end_date") @db.Date
  status     String   @default("pending")
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("leave_requests")
}
```

**Design decisions:**
- `directUrl` is set separately from `url` to support pgbouncer in production (pooled `url`, direct `directUrl` for migrations).
- `@@map` annotations align Prisma model names (PascalCase) with the existing snake_case Postgres table names.
- `@updatedAt` on `updatedAt` fields works alongside the existing `set_updated_at()` Postgres trigger — both set the same column, which is harmless.
- `company_id`, `department_id`, `position_id` are absent — they are dropped by migration `0006`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Server Action input validation rejects invalid inputs

*For any* Server Action (`createEmployee`, `updateEmployee`, `uploadDocument`, etc.) and *any* input that fails Zod schema validation, the action SHALL return `{ success: false, error: string }` without executing any database query.

**Validates: Requirements 2.2, 2.3**

### Property 2: Server Action success response shape

*For any* Server Action and *any* valid input that results in a successful database operation, the action SHALL return `{ success: true, data: T }` where `T` is the corresponding Prisma model type and `data` contains the fields from the input.

**Validates: Requirements 2.4**

### Property 3: Server Actions require an authenticated session

*For any* Server Action and *any* call made without a valid Supabase Auth session, the action SHALL return `{ success: false, error: "errors.unauthorized" }` without executing any database query.

**Validates: Requirements 4.3**

### Property 4: Employee mutation round-trip

*For any* valid employee creation input, calling `createEmployee` and then fetching the returned employee by ID SHALL yield a record whose `nameAr`, `nameEn`, `email`, `phone`, `status`, and `hireDate` fields match the original input.

**Validates: Requirements 6.1, 6.2**

### Property 5: Employee list filter correctness

*For any* combination of search query `q` and status filter, every employee returned by `listEmployees` SHALL satisfy both conditions: (a) if `q` is non-empty, at least one of `nameAr`, `nameEn`, or `email` contains `q` (case-insensitive); (b) if `status` is not `"all"`, the employee's `status` equals the filter value.

**Validates: Requirements 6.4**

### Property 6: Document list ordering invariant

*For any* employee with multiple documents, the list returned by `listDocuments(employeeId)` SHALL be ordered such that for every adjacent pair `(a, b)`, `a.uploadedAt >= b.uploadedAt` (descending order).

**Validates: Requirements 7.5**

### Property 7: Server Action errors return i18n keys

*For any* Server Action that returns `{ success: false, error: string }`, the `error` value SHALL be a dot-notation translation key (matching the pattern `[a-z]+(\.[a-zA-Z]+)+`) rather than a hardcoded human-readable string.

**Validates: Requirements 9.2**

---

## Error Handling

### Server Action Error Strategy

All Server Actions follow a uniform error handling pattern:

```typescript
// Pattern used in every Server Action
export async function someAction(input: unknown): Promise<ActionResult<T>> {
  // 1. Auth check
  const user = await getServerUser(); // throws redirect if no session

  // 2. Input validation
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  // 3. DB operation
  try {
    const result = await prisma.model.operation(parsed.data);
    revalidatePath("...");
    return { success: true, data: result };
  } catch (err) {
    console.error("[someAction]", err);
    return { success: false, error: "errors.serverError" };
  }
}
```

### Error Categories

| Error | Handling |
|---|---|
| Missing session | `getServerUser()` calls `redirect('/[locale]/login')` |
| Zod validation failure | Return `{ success: false, error: "errors.invalidInput" }` |
| Prisma `P2025` (record not found) | Return `{ success: false, error: "errors.notFound" }` |
| Prisma `P2002` (unique constraint) | Return `{ success: false, error: "errors.duplicate" }` |
| Storage upload failure | Rollback DB row, return `{ success: false, error: "errors.uploadFailed" }` |
| Unexpected DB error | Log server-side, return `{ success: false, error: "errors.serverError" }` |

### Server Component Error Handling

Server Components wrap data fetching in `try/catch` and use Next.js `error.tsx` boundaries:

```typescript
// app/[locale]/(app)/employees/error.tsx
"use client";
export default function EmployeesError({ error, reset }) {
  return <ErrorFallback onRetry={reset} />;
}
```

For missing records, Server Components call `notFound()` directly:

```typescript
const employee = await prisma.employee.findUnique({ where: { id } });
if (!employee) notFound();
```

---

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit/example tests for specific behaviors with property-based tests for universal invariants.

**Property-Based Testing Library**: [`fast-check`](https://github.com/dubzzz/fast-check) — chosen for its TypeScript-first API and compatibility with the existing Jest/Vitest ecosystem.

### Unit Tests (Example-Based)

Focus on specific behaviors and integration points:

- `getServerUser()` returns user with valid session; throws redirect with no session
- `signUp` Server Action passes `full_name` in `raw_user_meta_data`
- `signIn` Server Action redirects to dashboard on success
- `signOut` Server Action invalidates session and redirects to login
- `deleteEmployee` Server Action calls both Prisma delete and Storage remove
- `uploadDocument` Server Action: insert → upload → update `storage_path` sequence
- `uploadDocument` rollback: if Storage upload fails, Prisma row is deleted
- `getSignedUrl` calls `createSignedUrl` with 300s TTL
- Dashboard `getEmployeeStats` uses a single `groupBy` query
- `getEmployee` calls `notFound()` when Prisma returns null
- `env.ts` throws descriptive error when `DATABASE_URL` is missing

### Property-Based Tests

Each property test runs a minimum of **100 iterations** via `fast-check`.

Tag format: `// Feature: nextjs-supabase-prisma-refactor, Property N: <property_text>`

**Property 1 — Input validation rejects invalid inputs**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 1: Server Action input validation rejects invalid inputs
fc.assert(fc.asyncProperty(fc.record({ nameAr: fc.constant("") }), async (invalidInput) => {
  const result = await createEmployee(invalidInput);
  expect(result.success).toBe(false);
  expect(typeof result.error).toBe("string");
  expect(mockPrisma.employee.create).not.toHaveBeenCalled();
}));
```

**Property 2 — Success response shape**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 2: Server Action success response shape
fc.assert(fc.asyncProperty(validEmployeeArb, async (input) => {
  const result = await createEmployee(input);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.nameAr).toBe(input.nameAr);
  }
}));
```

**Property 3 — Session guard**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 3: Server Actions require an authenticated session
fc.assert(fc.asyncProperty(fc.anything(), async (anyInput) => {
  mockGetServerUser.mockRejectedValue(new Error("redirect"));
  const result = await createEmployee(anyInput as any);
  // Action should not reach DB
  expect(mockPrisma.employee.create).not.toHaveBeenCalled();
}));
```

**Property 4 — Employee mutation round-trip**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 4: Employee mutation round-trip
fc.assert(fc.asyncProperty(validEmployeeArb, async (input) => {
  const result = await createEmployee(input);
  if (result.success) {
    expect(result.data.nameAr).toBe(input.nameAr);
    expect(result.data.status).toBe(input.status ?? "active");
  }
}));
```

**Property 5 — Filter correctness**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 5: Employee list filter correctness
fc.assert(fc.asyncProperty(fc.string(), statusArb, async (q, status) => {
  const result = await listEmployees({ q, status, page: 1, pageSize: 50 });
  result.items.forEach((emp) => {
    if (q.trim()) {
      const matches = [emp.nameAr, emp.nameEn, emp.email]
        .some((f) => f?.toLowerCase().includes(q.toLowerCase()));
      expect(matches).toBe(true);
    }
    if (status !== "all") {
      expect(emp.status).toBe(status);
    }
  });
}));
```

**Property 6 — Document ordering**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 6: Document list ordering invariant
fc.assert(fc.asyncProperty(fc.uuid(), async (employeeId) => {
  const docs = await listDocuments(employeeId);
  for (let i = 0; i < docs.length - 1; i++) {
    expect(docs[i].uploadedAt >= docs[i + 1].uploadedAt).toBe(true);
  }
}));
```

**Property 7 — i18n error keys**
```typescript
// Feature: nextjs-supabase-prisma-refactor, Property 7: Server Action errors return i18n keys
const I18N_KEY_PATTERN = /^[a-z]+(\.[a-zA-Z]+)+$/;
fc.assert(fc.asyncProperty(invalidInputArb, async (input) => {
  const result = await createEmployee(input);
  if (!result.success) {
    expect(I18N_KEY_PATTERN.test(result.error)).toBe(true);
  }
}));
```

---

## Auth Layer

### `src/lib/auth/user.ts`

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type ServerUser = {
  id: string;
  email: string | undefined;
};

/**
 * Returns the currently authenticated Supabase user.
 * If no valid session exists, redirects to the login page.
 * Safe to call from Server Components and Server Actions.
 */
export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Determine locale from the current request path for the redirect URL.
    // Falls back to "ar" (the default locale) if headers are unavailable.
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const locale = pathname.startsWith("/en") ? "en" : "ar";
    redirect(`/${locale}/login`);
  }

  return { id: user.id, email: user.email };
}
```

**Design decisions:**
- Uses `supabase.auth.getUser()` (not `getSession()`) — validates the JWT against the Supabase server, cannot be spoofed by a tampered cookie.
- Calls `redirect()` (Next.js server redirect) rather than returning an error, so callers don't need to handle the unauthenticated case.
- The locale detection is best-effort; the middleware already handles the canonical redirect with the correct `next` param.

### `src/lib/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Design decisions:**
- The `globalThis` singleton pattern prevents multiple Prisma Client instances during Next.js hot-reload in development.
- In production (Vercel serverless), each function invocation gets a fresh module scope, so the singleton is effectively per-invocation — this is correct behaviour.
- `DATABASE_URL` is read from `process.env` by Prisma automatically via the `datasource` block in `schema.prisma`.

### `src/lib/env.ts` (updated)

```typescript
import { z } from "zod";

// Client-safe variables (NEXT_PUBLIC_ prefix)
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

// Server-only variables (validated at startup, never sent to browser)
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

export const env = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

// Server env is only validated on the server (typeof window === "undefined")
export const serverEnv =
  typeof window === "undefined"
    ? serverSchema.parse({
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      })
    : ({} as z.infer<typeof serverSchema>);
```

---

## Server Actions

### Shared Types

```typescript
// src/actions/types.ts
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### `src/actions/auth.ts`

```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import type { ActionResult } from "./types";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  locale: z.string().default("ar"),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  locale: z.string().default("ar"),
});

export async function signIn(input: unknown): Promise<ActionResult<void>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { success: false, error: "auth.loginError" };
  redirect(`/${parsed.data.locale}/dashboard`);
}

export async function signUp(input: unknown): Promise<ActionResult<void>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) return { success: false, error: "auth.signupError" };
  return { success: true, data: undefined };
}

export async function signOut(locale = "ar"): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
```

### `src/actions/employees.ts`

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth/user";
import type { ActionResult } from "./types";
import type { Employee } from "@prisma/client";

const createEmployeeSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "terminated"]).default("active"),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

export async function createEmployee(input: unknown): Promise<ActionResult<Employee>> {
  await getServerUser();

  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  try {
    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : null,
      },
    });
    revalidatePath("/[locale]/employees", "page");
    revalidatePath("/[locale]/dashboard", "page");
    return { success: true, data: employee };
  } catch (err) {
    console.error("[createEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult<Employee>> {
  await getServerUser();

  const parsed = updateEmployeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : undefined,
      },
    });
    revalidatePath("/[locale]/employees", "page");
    revalidatePath(`/[locale]/employees/${id}`, "page");
    return { success: true, data: employee };
  } catch (err: any) {
    if (err?.code === "P2025") return { success: false, error: "errors.notFound" };
    console.error("[updateEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult<void>> {
  await getServerUser();

  try {
    // Fetch all documents to remove from Storage
    const docs = await prisma.document.findMany({ where: { employeeId: id } });

    // Remove Storage objects
    if (docs.length > 0) {
      const supabase = await createSupabaseServerClient();
      const paths = docs.map((d) => d.storagePath);
      await supabase.storage.from("employee-documents").remove(paths);
    }

    // Delete employee (cascades to documents in DB)
    await prisma.employee.delete({ where: { id } });

    revalidatePath("/[locale]/employees", "page");
    revalidatePath("/[locale]/dashboard", "page");
    return { success: true, data: undefined };
  } catch (err: any) {
    if (err?.code === "P2025") return { success: false, error: "errors.notFound" };
    console.error("[deleteEmployee]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function listEmployees(params: {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<ActionResult<{ items: Employee[]; total: number }>> {
  await getServerUser();

  const { q, status, page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(q?.trim()
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" as const } },
            { nameEn: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && status !== "all" ? { status: status as any } : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.employee.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.employee.count({ where }),
    ]);
    return { success: true, data: { items, total } };
  } catch (err) {
    console.error("[listEmployees]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function getEmployeeStats(): Promise<
  ActionResult<{ total: number; active: number; inactive: number; terminated: number }>
> {
  await getServerUser();

  try {
    const groups = await prisma.employee.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const count = (s: string) =>
      groups.find((g) => g.status === s)?._count._all ?? 0;

    const total = groups.reduce((sum, g) => sum + g._count._all, 0);
    return {
      success: true,
      data: {
        total,
        active: count("active"),
        inactive: count("inactive"),
        terminated: count("terminated"),
      },
    };
  } catch (err) {
    console.error("[getEmployeeStats]", err);
    return { success: false, error: "errors.serverError" };
  }
}
```

### `src/actions/documents.ts`

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/user";
import type { ActionResult } from "./types";
import type { Document } from "@prisma/client";

const uploadDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(["introduction", "contract", "attachment"]),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  fileName: z.string().min(1),
  mimeType: z.string().optional().nullable(),
  byteSize: z.number().int().optional().nullable(),
});

export async function uploadDocument(
  metadata: unknown,
  file: FormData
): Promise<ActionResult<Document>> {
  await getServerUser();

  const parsed = uploadDocumentSchema.safeParse(metadata);
  if (!parsed.success) return { success: false, error: "errors.invalidInput" };

  const fileData = file.get("file") as File | null;
  if (!fileData) return { success: false, error: "errors.invalidInput" };

  const BUCKET = "employee-documents";

  // 1. Insert metadata row (storage_path = "pending" placeholder)
  let doc: Document;
  try {
    doc = await prisma.document.create({
      data: {
        employeeId: parsed.data.employeeId,
        type: parsed.data.type,
        title: parsed.data.title ?? parsed.data.fileName,
        description: parsed.data.description ?? null,
        storageBucket: BUCKET,
        storagePath: "pending",
        mimeType: parsed.data.mimeType ?? null,
        byteSize: parsed.data.byteSize ? BigInt(parsed.data.byteSize) : null,
        version: 1,
      },
    });
  } catch (err) {
    console.error("[uploadDocument] insert", err);
    return { success: false, error: "errors.serverError" };
  }

  // 2. Build deterministic storage path
  const storagePath = `employee/${parsed.data.employeeId}/document/${doc.id}/v1/${parsed.data.fileName}`;

  // 3. Upload to Supabase Storage
  const supabase = await createSupabaseServerClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileData, { upsert: false, contentType: parsed.data.mimeType ?? undefined });

  if (uploadErr) {
    // Rollback: delete the metadata row
    await prisma.document.delete({ where: { id: doc.id } }).catch(() => {});
    return { success: false, error: "errors.uploadFailed" };
  }

  // 4. Update storage_path with the real path
  try {
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { storagePath },
    });
    revalidatePath(`/[locale]/employees/${parsed.data.employeeId}`, "page");
    return { success: true, data: updated };
  } catch (err) {
    console.error("[uploadDocument] update path", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteDocument(id: string): Promise<ActionResult<void>> {
  await getServerUser();

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, error: "errors.notFound" };

    // Remove from Storage first
    const supabase = await createSupabaseServerClient();
    await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]);

    // Delete DB row
    await prisma.document.delete({ where: { id } });

    revalidatePath(`/[locale]/employees/${doc.employeeId}`, "page");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[deleteDocument]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function getSignedUrl(id: string): Promise<ActionResult<string>> {
  await getServerUser();

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, error: "errors.notFound" };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(doc.storageBucket)
      .createSignedUrl(doc.storagePath, 300);

    if (error) return { success: false, error: "errors.serverError" };
    return { success: true, data: data.signedUrl };
  } catch (err) {
    console.error("[getSignedUrl]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function listDocuments(employeeId: string): Promise<ActionResult<Document[]>> {
  await getServerUser();

  try {
    const docs = await prisma.document.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: "desc" },
    });
    return { success: true, data: docs };
  } catch (err) {
    console.error("[listDocuments]", err);
    return { success: false, error: "errors.serverError" };
  }
}
```

---

## Auth Flow

### Sign-Up Sequence

```
1. User fills SignupForm (Client Component)
2. Form calls signUp Server Action with { email, password, fullName, locale }
3. Server Action:
   a. Zod validates input
   b. supabase.auth.signUp({ email, password, options: { data: { full_name } } })
   c. Supabase creates auth.users row
   d. handle_new_user() trigger fires:
      - inserts user_profiles row (id = auth.uid(), full_name_en, email)
   e. Returns { success: true }
4. Client Component shows success toast, redirects to /[locale]/login
```

### Sign-In Sequence

```
1. User fills LoginForm (Client Component)
2. Form calls signIn Server Action with { email, password, locale }
3. Server Action:
   a. Zod validates input
   b. supabase.auth.signInWithPassword({ email, password })
   c. Supabase sets session cookies (via @supabase/ssr cookie helpers)
   d. redirect(`/${locale}/dashboard`) — Next.js server redirect
4. Browser follows redirect to /[locale]/dashboard
5. middleware.ts: getUser() validates session, passes through
6. Dashboard Server Component renders with fresh data
```

### Sign-Out Sequence

```
1. User clicks sign-out button (Client Component)
2. Calls signOut Server Action with current locale
3. Server Action:
   a. supabase.auth.signOut() — clears session cookies
   b. redirect(`/${locale}/login`)
4. Browser follows redirect to /[locale]/login
5. middleware.ts: no session found, public path — passes through
```

### Session Refresh (Every Request)

```
middleware.ts (runs on every non-static request):
1. createServerClient with cookie read/write helpers
2. supabase.auth.getUser() — validates JWT, refreshes if near expiry
3. If user exists + protected path → pass through (intlMiddleware)
4. If no user + protected path → redirect to /[locale]/login?next=<path>
5. If user exists + public path → redirect to /[locale]/dashboard
```

---

## Storage Strategy

### Bucket Configuration

- Bucket name: `employee-documents`
- Access: private (no public access)
- RLS: authenticated users can read/write (enforced by Supabase Storage policies)

### Storage Path Convention

```
employee/{employee_id}/document/{doc_id}/v1/{original_filename}
```

Example: `employee/abc-123/document/def-456/v1/contract.pdf`

**Design decisions:**
- `employee_id` as the top-level prefix enables efficient listing and deletion of all documents for an employee.
- `doc_id` as a sub-prefix ensures uniqueness even if the same filename is uploaded twice.
- `v1/` prefix reserves space for future versioning without path conflicts.
- Original filename is preserved for human readability in the Storage console.

### Upload Flow

```
Server Action: uploadDocument(metadata, file: FormData)
│
├── 1. getServerUser() — auth check
├── 2. zod.parse(metadata) — validate
├── 3. prisma.document.create({ storagePath: "pending" })
│      → get doc.id
├── 4. Build path: employee/{employeeId}/document/{doc.id}/v1/{fileName}
├── 5. supabase.storage.upload(path, file)
│      → if error:
│           prisma.document.delete({ id: doc.id })
│           return { success: false, error: "errors.uploadFailed" }
├── 6. prisma.document.update({ storagePath: path })
├── 7. revalidatePath(...)
└── 8. return { success: true, data: updatedDoc }
```

### Signed URL Flow

```
Server Action: getSignedUrl(docId)
│
├── 1. getServerUser() — auth check
├── 2. prisma.document.findUnique({ id: docId })
├── 3. supabase.storage.createSignedUrl(storagePath, 300)
└── 4. return { success: true, data: signedUrl }

Note: signedUrl is returned to the Client Component.
      The Storage bucket credentials never leave the server.
      TTL = 300 seconds (5 minutes).
```

### Delete Flow

```
Server Action: deleteDocument(docId)
│
├── 1. getServerUser() — auth check
├── 2. prisma.document.findUnique({ id: docId }) — get storagePath
├── 3. supabase.storage.remove([storagePath])
├── 4. prisma.document.delete({ id: docId })
├── 5. revalidatePath(...)
└── 6. return { success: true }
```

---

## Environment Variables

### `.env.example`

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Supabase — Public (safe to expose to the browser)
# ─────────────────────────────────────────────────────────────────────────────

# Your Supabase project URL (found in Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anon/public key (safe for browser use; RLS enforces access control)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ─────────────────────────────────────────────────────────────────────────────
# Supabase — Server-only secrets (NEVER prefix with NEXT_PUBLIC_)
# ─────────────────────────────────────────────────────────────────────────────

# Supabase service role key (bypasses RLS; used only in trusted server contexts)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ─────────────────────────────────────────────────────────────────────────────
# Prisma / PostgreSQL
# ─────────────────────────────────────────────────────────────────────────────

# Pooled connection string for Prisma in production (Supabase pgbouncer).
# Found in: Supabase Dashboard > Project Settings > Database > Connection Pooling
# Append ?pgbouncer=true&connection_limit=1 for serverless environments.
DATABASE_URL=postgresql://postgres.your-project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Direct (non-pooled) connection string for Prisma migrations.
# Found in: Supabase Dashboard > Project Settings > Database > Connection string (URI)
DIRECT_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres
```

---

## Migration Strategy

Step-by-step guide to migrate from the current architecture to the target.

### Step 1: Install Dependencies

```bash
npm install prisma @prisma/client
npm install --save-dev prisma
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && next build"
  }
}
```

### Step 2: Create Prisma Schema

Create `prisma/schema.prisma` with the schema defined in the Data Models section above.

Run `npx prisma generate` to generate the Prisma Client types.

### Step 3: Apply Database Migration

Apply the new Supabase migration to simplify the schema:

```bash
supabase db push
# or
supabase migration up
```

This runs `0006_simplify_schema.sql` which:
- Drops `companies`, `roles`, `company_memberships`, `departments`, `positions`
- Removes `company_id`, `department_id`, `position_id` from `employees`
- Removes `company_id` from `documents`, `attendance_events`, `leave_requests`
- Replaces complex RBAC RLS policies with `auth.uid() IS NOT NULL`
- Simplifies `handle_new_user` trigger

### Step 4: Add Server Infrastructure

Create in order:
1. `src/lib/prisma.ts` — Prisma singleton
2. `src/lib/auth/user.ts` — `getServerUser()` helper
3. `src/lib/env.ts` — add `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY` validation
4. `src/actions/types.ts` — shared `ActionResult<T>` type

### Step 5: Implement Server Actions

Create:
1. `src/actions/auth.ts` — `signIn`, `signUp`, `signOut`
2. `src/actions/employees.ts` — `createEmployee`, `updateEmployee`, `deleteEmployee`, `listEmployees`, `getEmployeeStats`
3. `src/actions/documents.ts` — `uploadDocument`, `deleteDocument`, `getSignedUrl`, `listDocuments`

### Step 6: Update Auth Forms

Update `login-form.tsx` and `signup-form.tsx` to call Server Actions instead of the Supabase client directly. Remove `auth-context.tsx` and `use-membership.ts` (no longer needed — auth is server-driven).

Update `(app)/layout.tsx` to call `getServerUser()` directly as the auth guard, replacing `<RequireAuth>`.

### Step 7: Convert Pages to Server Components

For each page:
1. Remove `"use client"` directive
2. Remove `useQuery` hooks
3. Add `async` to the page function
4. Call `getServerUser()` at the top
5. Fetch data directly via `prisma.*` or Server Action query functions
6. Wrap async data-fetching sub-components in `<Suspense>` with skeleton fallbacks
7. Pass data as props to Client Components

**Dashboard page example:**
```typescript
// app/[locale]/(app)/dashboard/page.tsx
import { getEmployeeStats } from "@/actions/employees";
import { getServerUser } from "@/lib/auth/user";
import { StatCard } from "@/features/dashboard/stat-card";
import { Suspense } from "react";

export default async function DashboardPage() {
  await getServerUser();
  const statsResult = await getEmployeeStats();
  const stats = statsResult.success ? statsResult.data : { total: 0, active: 0, inactive: 0, terminated: 0 };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="..." value={stats.total} icon={...} colorClass="..." />
          {/* ... */}
        </div>
      </Suspense>
    </div>
  );
}
```

### Step 8: Update Client Components

Update interactive Client Components to call Server Actions:
- `employee-form.tsx`: replace `createEmployee`/`updateEmployee` from `src/data/employees.ts` with Server Actions
- `delete-employee-dialog.tsx`: replace `deleteEmployee` with Server Action
- `document-upload-form.tsx`: replace `uploadDocument` with Server Action
- `documents-list.tsx`: call `getSignedUrl` Server Action on demand

### Step 9: Clean Up

Remove files that are no longer needed:
- `src/data/employees.ts`
- `src/data/documents.ts`
- `src/data/departments.ts`
- `src/data/positions.ts`
- `src/data/queryKeys.ts`
- `src/features/auth/auth-context.tsx`
- `src/features/auth/use-membership.ts`
- `src/components/auth/require-auth.tsx`

React Query provider (`src/lib/react-query/provider.tsx`) can be kept if optimistic updates are desired, or removed if not needed.

### Step 10: Verify

```bash
npx prisma generate          # Ensure Prisma Client generates without errors
npx tsc --noEmit             # Ensure no TypeScript errors
next build                   # Full production build check
```

---
