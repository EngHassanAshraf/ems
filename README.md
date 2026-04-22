# نظام إدارة الموظفين — Employee Manager

Arabic-first (RTL) employee management system built with Next.js, Supabase, and Prisma.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form 7 + Zod 4 |
| i18n | next-intl 4 (Arabic only, RTL) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Auth | Supabase Auth (JWT, cookie-based sessions) |
| Storage | Supabase Storage (private bucket, signed URLs) |

---

## Features

- **Authentication** — signup, login, session management via Supabase Auth
- **Role-based access control** — `super_admin` and `site_admin` roles
- **Sites** — manage work sites (super_admin only)
- **Job Titles** — manage job title catalog (super_admin only)
- **Employees** — full CRUD with site assignment, job title, status (`active` / `fired`)
- **Users** — create and manage system users with role and site assignment (super_admin only)
- **Documents** — upload, open, and download employee documents via Supabase Storage
- **Reports** — active employee count per job title per site (matrix view)
- **No locale prefix** — all routes are at `/dashboard`, `/employees`, etc.

---

## Roles

| Role | Access |
|---|---|
| `super_admin` | Full access — all sites, all employees, sites/users/job-titles management, reports |
| `site_admin` | Scoped to their assigned site — can only manage employees of their site |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/EngHassanAshraf/ems.git
cd ems
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL="postgresql://postgres.[ref]:[password]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@[host]:5432/postgres"
```

### 3. Set up the database

Run these SQL files in order in your **Supabase SQL Editor**:

```
supabase/migrations/0001_init_schema.sql
supabase/migrations/0002_indexes_search.sql
supabase/migrations/0003_rls_policies.sql
supabase/migrations/0004_storage_buckets.sql
supabase/migrations/0005_auto_provision_user.sql
supabase/migrations/0006_simplify_schema.sql
supabase/migrations/0007_add_sites.sql
```

Then run these additional SQL statements manually:

```sql
-- Add role and site to user_profiles
create type public.user_role as enum ('super_admin', 'site_admin');
alter table public.user_profiles
  add column if not exists role public.user_role not null default 'site_admin',
  add column if not exists site_id uuid references public.sites(id) on delete set null;

-- Add job_title_id and fired_reason to employees
create table if not exists public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.employees
  add column if not exists job_title_id uuid references public.job_titles(id) on delete set null,
  add column if not exists fired_reason text;

-- Update employee status enum to active/fired
alter type public.employee_status add value if not exists 'fired';
```

### 4. Set your account as super_admin

After signing up, run in SQL Editor (replace with your user UUID from Supabase Auth → Users):

```sql
update public.user_profiles set role = 'super_admin' where id = 'YOUR-USER-UUID';
```

### 5. Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000` — redirects to `/dashboard`.

---

## Available Scripts

```bash
npm run dev        # development server
npm run build      # prisma generate + next build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # TypeScript check (no emit)
```

---

## Routes

### Public (unauthenticated)

| Route | Description |
|---|---|
| `/login` | Sign-in page |
| `/signup` | Create account |

### Protected (require session)

| Route | Access | Description |
|---|---|---|
| `/dashboard` | All | Stats + recent employees |
| `/employees` | All | Employee list with filters |
| `/employees/[id]` | All | Employee detail + documents |
| `/documents` | All | Document browser |
| `/reports` | All | Job title × site matrix |
| `/sites` | super_admin | Sites CRUD |
| `/users` | super_admin | Users management |
| `/job-titles` | super_admin | Job titles CRUD |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              — protected routes (require auth)
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── documents/
│   │   ├── reports/
│   │   ├── sites/
│   │   ├── users/
│   │   └── job-titles/
│   ├── (auth)/             — public routes
│   │   ├── login/
│   │   └── signup/
│   ├── layout.tsx          — root layout (RTL, Arabic, providers)
│   └── page.tsx            — redirects to /dashboard
├── actions/                — Next.js server actions
│   ├── auth.ts
│   ├── employees.ts
│   ├── documents.ts
│   ├── sites.ts
│   ├── users.ts
│   ├── job-titles.ts
│   └── reports.ts
├── features/               — UI feature modules
│   ├── auth/
│   ├── dashboard/
│   ├── employees/
│   ├── documents/
│   ├── sites/
│   ├── users/
│   ├── job-titles/
│   └── reports/
├── components/
│   ├── layout/             — app shell, sidebar, topbar
│   └── ui/                 — button, input, select, dialog, toast…
└── lib/
    ├── auth/user.ts        — getServerUser(), role helpers
    ├── prisma.ts           — Prisma client singleton
    ├── env.ts              — Zod-validated env vars
    └── supabase/           — browser + server Supabase clients

supabase/migrations/        — SQL migration files
messages/ar.json            — Arabic translations
middleware.ts               — Auth guard + next-intl
prisma/schema.prisma        — Prisma schema
```

---

## Database Schema (key tables)

| Table | Description |
|---|---|
| `user_profiles` | Auth user profiles with `role` and `site_id` |
| `sites` | Work sites |
| `job_titles` | Job title catalog |
| `employees` | Employee records with `site_id`, `job_title_id`, `status`, `fired_reason` |
| `documents` | Document metadata (files in Supabase Storage) |
| `attendance_events` | Future module |
| `leave_requests` | Future module |

### Employee status

```
active  — currently employed
fired   — terminated (requires fired_reason)
```

---

## Storage

**Bucket:** `employee-documents` (private, 50 MB limit)

**Allowed types:** PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX

**Access:** Files are never publicly accessible. All access goes through server-generated signed URLs (5-minute TTL).

**Path format:**
```
employee/{employeeId}/document/{documentId}/v1/{sanitized-filename}
```

---

## Deployment on Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add environment variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `DATABASE_URL` | Pooler connection string (`?pgbouncer=true`) |
| `DIRECT_URL` | Direct connection string (for migrations) |

4. Deploy — Vercel runs `prisma generate && next build` automatically.

---

## Security Notes

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose — all access is gated by RLS
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — never expose to the browser or commit it
- Documents are in a **private** bucket — only signed URLs with short TTLs are served
- Sessions are managed server-side via `@supabase/ssr` cookies
