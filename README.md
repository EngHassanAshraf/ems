# نظام إدارة الموظفين — Employee Manager

Arabic-first (RTL) employee information and document management system, built as a modular SaaS-ready foundation for a full HR/ERP platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 3 + CSS design tokens |
| Components | Custom UI library (shadcn-inspired) |
| State / Data | TanStack React Query 5 |
| Forms | React Hook Form 7 + Zod 4 |
| i18n | next-intl 4 (Arabic default, RTL-first) |
| Backend | Supabase (Postgres + Auth + Storage) |
| Auth | Supabase Auth (JWT sessions) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| Authorization | PostgreSQL Row Level Security (RLS) |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd employee_manager
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only
```

### 3. Apply database migrations

Run migrations in order against your Supabase project (SQL editor or Supabase CLI):

```
supabase/migrations/0001_init_schema.sql       — core tables + triggers
supabase/migrations/0002_indexes_search.sql    — pg_trgm full-text indexes
supabase/migrations/0003_rls_policies.sql      — RLS policies + helper functions
supabase/migrations/0004_storage_buckets.sql   — storage bucket + storage RLS
```

### 4. Seed reference data

```
supabase/seed/001_roles.sql          — seeds admin / hr / employee roles
supabase/seed/002_demo_company.sql   — demo company, departments, positions
```

### 5. Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000` — redirects to `/ar/dashboard` by default.

---

## Available Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # TypeScript type check (no emit)
```

---

## Application Routes

All routes are locale-prefixed. Default locale is `ar` (Arabic/RTL). Supported locales: `ar`, `en`.

### Public routes (unauthenticated)

| Route | Description |
|---|---|
| `/{locale}/login` | Sign-in page |
| `/{locale}/signup` | Create account page |

### Protected routes (require active session)

Unauthenticated requests are redirected to `/{locale}/login?next=<original-path>`.

| Route | Description |
|---|---|
| `/{locale}` | Root — redirects to `/{locale}/dashboard` |
| `/{locale}/dashboard` | Dashboard with employee stats and recent activity |
| `/{locale}/employees` | Employee list with search, filter, pagination |
| `/{locale}/employees/[id]` | Employee detail — profile + embedded documents |
| `/{locale}/documents` | Global document browser — employee picker + document list |

### Route examples

```
/ar/dashboard
/ar/employees
/ar/employees/3f2a1b4c-...
/ar/documents
/en/dashboard
/en/employees
```

---

## Data Access Layer

All Supabase queries are centralized in `src/data/`. Feature components never call Supabase directly.

### Employees — `src/data/employees.ts`

| Function | Supabase operation | Description |
|---|---|---|
| `listEmployees(params)` | `SELECT * FROM employees` | Paginated list with optional search (`name_ar`, `name_en`, `email`) and status filter |
| `getEmployee(id)` | `SELECT *, departments(*), positions(*)` | Single employee with joined department and position names |
| `createEmployee(input)` | `INSERT INTO employees` | Create employee, validated with Zod |
| `updateEmployee(id, input)` | `UPDATE employees WHERE id = ?` | Partial update, validated with Zod |
| `deleteEmployee(id)` | `DELETE FROM employees WHERE id = ?` | Hard delete |
| `getEmployeeStats()` | `SELECT status FROM employees` | Returns `{ total, active, inactive, terminated }` counts |

#### `listEmployees` params

```ts
{
  q?: string        // search term (Arabic name, English name, or email)
  page: number      // 1-based
  pageSize: number  // rows per page (default 15)
  status?: string   // "active" | "inactive" | "terminated" | "all"
}
```

#### Employee schema

```ts
{
  id: string (uuid)
  company_id: string (uuid)
  auth_user_id: string | null
  name_ar: string               // required
  name_en: string | null
  email: string | null
  phone: string | null
  address: string | null
  department_id: string | null
  position_id: string | null
  hire_date: string | null      // ISO date "YYYY-MM-DD"
  status: "active" | "inactive" | "terminated"
  created_at: string            // ISO timestamp
  updated_at: string
}
```

---

### Documents — `src/data/documents.ts`

| Function | Supabase operation | Description |
|---|---|---|
| `listEmployeeDocuments(employeeId)` | `SELECT * FROM documents WHERE employee_id = ?` | All documents for an employee, ordered by `uploaded_at DESC` |
| `uploadDocument(input)` | INSERT metadata → Storage upload → UPDATE path | Atomic upload: creates metadata row, uploads file, updates path. Rolls back metadata on storage failure |
| `createSignedDocumentUrl(doc, ttl?)` | `storage.createSignedUrl(path, ttl)` | Generates a time-limited signed URL (default TTL: 300s) |
| `deleteDocument(doc)` | Storage remove → `DELETE FROM documents` | Deletes storage object first, then metadata row |

#### `uploadDocument` input

```ts
{
  companyId: string
  employeeId: string
  type: "introduction" | "contract" | "attachment"
  title?: string
  description?: string
  file: File
}
```

#### Storage path format

```
company/{companyId}/employee/{employeeId}/document/{documentId}/v{version}/{filename}
```

Example:
```
company/0f3a.../employee/aa1b.../document/11cd.../v1/contract.pdf
```

#### Document schema

```ts
{
  id: string (uuid)
  company_id: string (uuid)
  employee_id: string (uuid)
  type: "introduction" | "contract" | "attachment"
  title: string | null
  description: string | null
  storage_bucket: string        // "employee-documents"
  storage_path: string          // full path in bucket
  mime_type: string | null
  byte_size: number | null      // bytes
  version: number               // starts at 1
  uploaded_at: string           // ISO timestamp
  created_at: string
}
```

---

### Departments — `src/data/departments.ts`

| Function | Supabase operation | Description |
|---|---|---|
| `listDepartments(companyId)` | `SELECT FROM departments WHERE company_id = ?` | All departments for a company, ordered by `name_ar` |
| `createDepartment(input)` | `INSERT INTO departments` | Create department |
| `deleteDepartment(id)` | `DELETE FROM departments WHERE id = ?` | Delete department |

---

### Positions — `src/data/positions.ts`

| Function | Supabase operation | Description |
|---|---|---|
| `listPositions(companyId)` | `SELECT FROM positions WHERE company_id = ?` | All positions for a company, ordered by `name_ar` |
| `createPosition(input)` | `INSERT INTO positions` | Create position |

---

### Auth / Membership — `src/features/auth/`

| Hook / Function | Description |
|---|---|
| `useAuth()` | Returns `{ user, session, loading, signOut }` from `AuthContext` |
| `useMembership()` | React Query hook — fetches the current user's active company membership and role. Returns `{ company_id, role_key, company_name_ar, company_name_en }` |

Membership query joins `company_memberships → roles → companies` and caches for 5 minutes.

---

## React Query Keys — `src/data/queryKeys.ts`

| Key factory | Cache key shape | Used by |
|---|---|---|
| `queryKeys.me()` | `["me"]` | Current user profile |
| `queryKeys.membership(userId)` | `["membership", userId]` | `useMembership` |
| `queryKeys.employees(params)` | `["employees", params]` | Employee list page |
| `queryKeys.employee(id)` | `["employees", id]` | Employee detail page |
| `queryKeys.employeeStats()` | `["employees", "stats"]` | Dashboard stats |
| `queryKeys.employeeDocuments(employeeId)` | `["employees", employeeId, "documents"]` | Document list |
| `queryKeys.departments(companyId)` | `["departments", companyId]` | Department select in forms |
| `queryKeys.positions(companyId)` | `["positions", companyId]` | Position select in forms |

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `companies` | Tenant root — one row per organization |
| `roles` | Global reference: `admin`, `hr`, `employee` |
| `user_profiles` | Extended profile linked to `auth.users` |
| `company_memberships` | Tenant boundary + RBAC — links user ↔ company ↔ role |
| `departments` | Per-company department lookup |
| `positions` | Per-company position/job title lookup |
| `employees` | Core employee records |
| `documents` | Document metadata (file lives in Storage) |
| `attendance_events` | Future module — check-in/check-out events |
| `leave_requests` | Future module — leave/vacation requests |

### Enums

```sql
employee_status: 'active' | 'inactive' | 'terminated'
document_type:   'introduction' | 'contract' | 'attachment'
```

### Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_employees_company` | employees | `company_id` | Tenant scoping |
| `idx_employees_company_status` | employees | `(company_id, status)` | Filtered list queries |
| `idx_employees_name_ar_trgm` | employees | `name_ar` (GIN trgm) | Arabic name search |
| `idx_employees_name_en_trgm` | employees | `name_en` (GIN trgm) | English name search |
| `idx_documents_company_employee` | documents | `(company_id, employee_id)` | Document list per employee |
| `idx_documents_employee_type` | documents | `(employee_id, type)` | Filtered document queries |
| `idx_company_memberships_company_user` | company_memberships | `(company_id, auth_user_id)` | RLS helper performance |

---

## Row Level Security (RLS)

All tables have RLS enabled. Authorization is enforced at the database layer — application code cannot bypass it.

### Helper functions

```sql
is_company_member(company_id)          -- user has active membership in company
has_company_role(company_id, role_key) -- user has specific role in company
is_hr_or_admin(company_id)             -- user is admin OR hr in company
```

### Policy summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `companies` | member of company | — | admin only | — |
| `roles` | any authenticated | — | — | — |
| `user_profiles` | own row only | own row only | own row only | — |
| `company_memberships` | own row or HR/Admin | HR/Admin | HR/Admin | Admin only |
| `departments` | any member | HR/Admin | HR/Admin | HR/Admin |
| `positions` | any member | HR/Admin | HR/Admin | HR/Admin |
| `employees` | HR/Admin or own row (via `auth_user_id`) | HR/Admin | HR/Admin | HR/Admin |
| `documents` | HR/Admin or own employee's docs | HR/Admin | HR/Admin | HR/Admin |
| `attendance_events` | HR/Admin | HR/Admin | HR/Admin | HR/Admin |
| `leave_requests` | HR/Admin | HR/Admin | HR/Admin | HR/Admin |

### Tenant isolation

Every business table carries `company_id`. RLS policies verify membership before any read or write. A user in Company A **cannot** read or write any row belonging to Company B — enforced at the Postgres level.

---

## Storage

### Bucket: `employee-documents`

| Property | Value |
|---|---|
| Visibility | Private (no public URLs) |
| Max file size | 50 MB |
| Allowed types | PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX |

### Access pattern

1. Client reads `documents` metadata row (RLS enforced — only authorized users see it)
2. Client calls `createSignedDocumentUrl(doc, ttl)` to get a time-limited URL
3. Client uses signed URL to download or preview the file

Signed URL TTLs:
- Preview: 300 seconds (5 min)
- Download: 300–900 seconds

### Storage RLS

Storage objects mirror the `documents` table RLS — only HR/Admin of the matching company (extracted from the path prefix `company/{company_id}/...`) can upload, read, or delete objects.

---

## Authentication Flow

```
User visits /{locale}/dashboard
  → middleware checks Supabase session
  → no session → redirect to /{locale}/login?next=/ar/dashboard
  → user signs in → session cookie set
  → redirect to original destination
```

Session is managed via `@supabase/ssr` cookies (server-side refresh) + `AuthContext` (client-side state).

---

## Localization

| Locale | Language | Direction | Default |
|---|---|---|---|
| `ar` | Arabic | RTL | ✅ |
| `en` | English | LTR | — |

- All routes are prefixed: `/ar/...`, `/en/...`
- `dir` attribute is set on `<html>` based on locale
- Fonts: **Cairo** (Arabic body), **Tajawal** (UI elements)
- Language toggle in topbar switches locale and preserves current path

### Adding translations

Edit `messages/ar.json` and `messages/en.json`. Keys are namespaced:

```
app.*         — app name, nav labels
common.*      — shared actions (save, cancel, delete…)
auth.*        — login/signup forms
dashboard.*   — dashboard page
employees.*   — employee module
documents.*   — document module
```

---

## Project Structure

```
src/
├── app/
│   └── [locale]/
│       ├── layout.tsx                  — root layout (fonts, providers, dir)
│       ├── page.tsx                    — redirects to /{locale}/dashboard
│       ├── (auth)/
│       │   ├── layout.tsx              — centered auth layout
│       │   ├── login/page.tsx
│       │   └── signup/page.tsx
│       └── (app)/
│           ├── layout.tsx              — app shell wrapper
│           ├── dashboard/page.tsx
│           ├── employees/
│           │   ├── page.tsx            — list + CRUD dialogs
│           │   └── [id]/page.tsx       — employee detail + documents
│           └── documents/page.tsx      — global document browser
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx               — responsive sidebar + topbar
│   │   ├── sidebar.tsx                 — nav, company name, sign out
│   │   └── topbar.tsx                  — language toggle, theme toggle, avatar
│   └── ui/
│       ├── button.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── textarea.tsx
│       ├── label.tsx
│       ├── badge.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── toast.tsx
│       ├── spinner.tsx
│       ├── empty-state.tsx
│       └── form-field.tsx
├── data/                               — data access layer (all Supabase calls)
│   ├── employees.ts
│   ├── documents.ts
│   ├── departments.ts
│   ├── positions.ts
│   └── queryKeys.ts
├── features/
│   ├── auth/
│   │   ├── auth-context.tsx            — session state provider
│   │   ├── use-membership.ts           — company + role hook
│   │   ├── login-form.tsx
│   │   └── signup-form.tsx
│   ├── dashboard/
│   │   └── stat-card.tsx
│   ├── employees/
│   │   ├── employee-form.tsx           — create/edit form
│   │   ├── employees-table.tsx
│   │   ├── employee-status-badge.tsx
│   │   └── delete-employee-dialog.tsx
│   └── documents/
│       ├── documents-list.tsx          — list + download + delete
│       └── document-upload-form.tsx    — drag-and-drop upload
├── i18n/
│   ├── locales.ts
│   └── request.ts
├── lib/
│   ├── env.ts                          — Zod-validated env vars
│   ├── utils.ts                        — cn() helper
│   ├── react-query/provider.tsx
│   ├── supabase/
│   │   ├── client.ts                   — browser Supabase client
│   │   ├── server.ts                   — server-side Supabase client (SSR)
│   │   └── middleware.ts               — session refresh in middleware
│   └── theme/provider.tsx              — light/dark/system theme
└── styles/
    └── globals.css                     — CSS variables + Tailwind base

supabase/
├── migrations/
│   ├── 0001_init_schema.sql
│   ├── 0002_indexes_search.sql
│   ├── 0003_rls_policies.sql
│   └── 0004_storage_buckets.sql
└── seed/
    ├── 001_roles.sql
    └── 002_demo_company.sql

messages/
├── ar.json
└── en.json

middleware.ts                           — next-intl + auth route protection
```

---

## Roles

| Role key | Arabic | Permissions |
|---|---|---|
| `admin` | مسؤول | Full access — CRUD all data, manage memberships, update company |
| `hr` | الموارد البشرية | CRUD employees, documents, departments, positions |
| `employee` | موظف | (Future) Read own employee record and own documents |

Roles are per-company. A user can be `admin` in one company and `hr` in another.

---

## Multi-Tenancy

Every business table has a `company_id` column. Tenant isolation is enforced by RLS — not by application code. The `company_memberships` table is the single source of truth for who belongs to which company and with what role.

To onboard a new company:
1. Insert a row into `companies`
2. Insert a row into `company_memberships` linking the admin user to the company with the `admin` role
3. Optionally seed departments and positions

---

## Evolution Path (Future Modules)

The schema already includes placeholder tables for:

| Module | Table | Status |
|---|---|---|
| Attendance | `attendance_events` | Schema ready, RLS applied, UI pending |
| Leave / Vacations | `leave_requests` | Schema ready, RLS applied, UI pending |
| Payroll | — | Planned — salary contracts, runs, payslips |
| Notifications | — | Planned — event log + delivery channels |
| Employee self-service | — | RLS policies pre-written (`employees_select_self`, `documents_select_self`) |

---

## Deployment

### Frontend — Vercel

```bash
npm run build
```

Set environment variables in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend — Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run migrations via Supabase SQL editor or CLI (`supabase db push`)
3. Run seed files
4. Enable email auth in Supabase Auth settings
5. Create the `employee-documents` storage bucket (or run `0004_storage_buckets.sql`)

---

## Security Notes

- The anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is safe to expose — all access is gated by RLS
- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — never expose it to the browser or commit it
- Document files are stored in a **private** bucket — direct object URLs are never exposed; only signed URLs with short TTLs are used
- Session cookies are managed server-side via `@supabase/ssr` to prevent token leakage
