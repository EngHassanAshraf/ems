# نظام إدارة الموظفين — Employee Manager

Arabic-first (RTL) employee management system built with Next.js 15, Supabase, and Prisma 7.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.3.9 (App Router) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form 7 + Zod 4 |
| i18n | next-intl 4 (Arabic only, RTL, no locale prefix) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 7.8 + `@prisma/adapter-pg` |
| Auth | Supabase Auth (JWT, cookie-based sessions via `@supabase/ssr`) |
| Storage | Supabase Storage (private + public buckets) |

---

## Features

| Feature | Description |
|---|---|
| **Authentication** | Login / logout via Supabase Auth. No self-registration — users are created by super_admin |
| **RBAC** | Three roles: `super_admin`, `site_admin`, `site_security_manager` |
| **Sites** | Work site management — CRUD (super_admin only) |
| **Job Titles** | Job title catalog — CRUD (super_admin only) |
| **Employees** | Full CRUD with employee code, site, job title, status (`active` / `fired` with reason), hire date, contact info |
| **Documents** | Upload, preview, and download employee documents (PDF, Word, Excel, PowerPoint, images) |
| **Users** | Create and manage system users with role, site, avatar, and status (super_admin only) |
| **Reports** | Active employee count matrix — job title × site |
| **Dashboard** | Stats (total / active / fired) + recent employees |

---

## Roles

| Role | Arabic | Access |
|---|---|---|
| `super_admin` | مدير عام | Full access — all sites, all employees, all management pages |
| `site_admin` | إداري موقع | Scoped to assigned site — manage employees of their site only |
| `site_security_manager` | مدير أمن موقع | Scoped to assigned site — same data scope as site_admin |

Site-scoped roles cannot:
- See or manage other sites' employees
- Change an employee's site assignment
- Access Sites, Users, or Job Titles management pages

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

Then run these additional statements:

```sql
-- Role enum and user_profiles columns
create type public.user_role as enum ('super_admin', 'site_admin', 'site_security_manager');
alter table public.user_profiles
  add column if not exists role public.user_role not null default 'site_admin',
  add column if not exists site_id uuid references public.sites(id) on delete set null;

-- Job titles table
create table if not exists public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_job_titles_updated_at before update on public.job_titles
  for each row execute function public.set_updated_at();
alter table public.job_titles enable row level security;
create policy job_titles_select on public.job_titles for select to authenticated using (true);
create policy job_titles_all on public.job_titles for all to authenticated using (true) with check (true);

-- Employee additional columns
alter table public.employees
  add column if not exists job_title_id uuid references public.job_titles(id) on delete set null,
  add column if not exists fired_reason text,
  add column if not exists employee_code text;

-- Update employee status enum
alter type public.employee_status add value if not exists 'fired';

-- updated_at defaults (required for Prisma)
alter table public.employees alter column updated_at set default now();
alter table public.documents alter column updated_at set default now();
alter table public.user_profiles alter column updated_at set default now();

-- Avatars storage bucket (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "authenticated can upload avatars" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "public can read avatars" on storage.objects for select to public using (bucket_id = 'avatars');
create policy "authenticated can update avatars" on storage.objects for update to authenticated using (bucket_id = 'avatars');
create policy "authenticated can delete avatars" on storage.objects for delete to authenticated using (bucket_id = 'avatars');
```

### 4. Set your account as super_admin

After your first login, run in SQL Editor (get your UUID from Supabase → Authentication → Users):

```sql
update public.user_profiles set role = 'super_admin' where id = 'YOUR-USER-UUID';
```

### 5. Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000` → redirects to `/dashboard`.

---

## Available Scripts

```bash
npm run dev        # development server (webpack, no Turbopack)
npm run build      # prisma generate + next build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # TypeScript check (no emit)
```

---

## Routes

### Public

| Route | Description |
|---|---|
| `/login` | Sign-in page |

### Protected (require session)

| Route | Access | Description |
|---|---|---|
| `/dashboard` | All | Stats cards + recent employees list |
| `/employees` | All | Employee list — search, status/site/job-title filters, pagination |
| `/employees/[id]` | All | Employee detail — profile fields + documents |
| `/documents` | All | Document browser — employee picker + document list |
| `/reports` | All | Active employees matrix — job title × site |
| `/sites` | super_admin | Sites CRUD |
| `/users` | super_admin | Users list + create/edit/delete |
| `/users/[id]` | super_admin | User profile — info, edit, avatar upload, delete |
| `/job-titles` | super_admin | Job titles CRUD |

### API

| Route | Description |
|---|---|
| `GET /api/documents/[id]` | Preview document in browser (redirects to signed URL) |
| `GET /api/documents/[id]?download=1` | Download document with correct filename and extension |

---

## Database Schema

### Enums

| Enum | Values |
|---|---|
| `employee_status` | `active`, `fired` |
| `document_type` | `introduction`, `contract`, `attachment` |
| `user_role` | `super_admin`, `site_admin`, `site_security_manager` |

### Tables

| Table | Key Fields |
|---|---|
| `user_profiles` | id, fullNameAr, phone, email, avatarUrl, isActive, role, siteId |
| `sites` | id, nameAr, isActive |
| `job_titles` | id, nameAr, isActive |
| `employees` | id, nameAr, employeeCode, email, phone, address, hireDate, status, firedReason, siteId, jobTitleId |
| `documents` | id, employeeId, type, title, storageBucket, storagePath, mimeType, byteSize, version |
| `attendance_events` | id, employeeId, eventType, occurredAt *(future module)* |
| `leave_requests` | id, employeeId, leaveType, startDate, endDate, status *(future module)* |

---

## Storage

### Buckets

| Bucket | Visibility | Max Size | Purpose |
|---|---|---|---|
| `employee-documents` | Private | 50 MB | Employee documents |
| `avatars` | Public | 5 MB | User profile avatars |

**Allowed document types:** PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX, PPT, PPTX

**Document path format:**
```
employee/{employeeId}/document/{documentId}/v1/{sanitized-filename}
```

**Access pattern:** Documents are never directly accessible. The API route `/api/documents/[id]` verifies auth, then either streams the file (download) or redirects to a 5-minute signed URL (preview).

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                  — protected routes
│   │   ├── dashboard/
│   │   ├── employees/[id]/
│   │   ├── documents/
│   │   ├── reports/
│   │   ├── sites/
│   │   ├── users/[id]/
│   │   └── job-titles/
│   ├── (auth)/login/           — public routes
│   ├── api/documents/[id]/     — document open/download API
│   ├── layout.tsx              — root layout (RTL, Arabic, providers)
│   └── page.tsx                — redirects to /dashboard
├── actions/                    — server actions (all data mutations)
│   ├── auth.ts                 — signIn, signOut
│   ├── employees.ts            — CRUD + stats + list with filters
│   ├── documents.ts            — upload, delete, signed URL, list
│   ├── sites.ts                — CRUD (super_admin gated)
│   ├── job-titles.ts           — CRUD (super_admin gated)
│   ├── users.ts                — CRUD + avatar (super_admin gated)
│   └── reports.ts              — job title × site matrix
├── features/                   — UI feature modules
│   ├── auth/                   — login form
│   ├── dashboard/              — stat card
│   ├── employees/              — form, table, status badge, delete dialog
│   ├── documents/              — upload form, list, client
│   ├── sites/                  — form, client
│   ├── job-titles/             — form, client
│   ├── users/                  — form, profile client, list client
│   └── reports/                — matrix client
├── components/
│   ├── layout/                 — app-shell, sidebar (with user avatar), topbar
│   └── ui/                     — button, input, select, textarea, dialog, toast, badge, card, spinner, empty-state, form-field
└── lib/
    ├── auth/user.ts            — getServerUser(), role helpers
    ├── prisma.ts               — Prisma singleton (pg adapter)
    ├── env.ts                  — Zod-validated env vars
    └── supabase/
        ├── admin.ts            — service role client (storage ops)
        ├── server.ts           — SSR client (cookie sessions)
        └── client.ts           — browser client

messages/
├── ar.json                     — Arabic translations
└── en.json                     — English translations

supabase/migrations/            — SQL migration files (0001–0007)
prisma/schema.prisma            — Prisma schema
middleware.ts                   — auth guard + next-intl (no locale prefix)
```

---

## Deployment on Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel project settings:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server-only, never expose |
| `DATABASE_URL` | Pooler URL with `?pgbouncer=true` (port 6543) |
| `DIRECT_URL` | Direct URL without pgbouncer (port 5432) |

4. Deploy — Vercel runs `prisma generate && next build` automatically via the `build` script.

**Note:** Server actions have a 10 MB body size limit configured in `next.config.ts` to support document uploads.

---

## Security Notes

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose — all DB access is gated by RLS
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — used only server-side for storage operations
- Documents are in a **private** bucket — never directly accessible, only via the API route which verifies auth first
- Sessions are managed server-side via `@supabase/ssr` cookies — not localStorage
- User creation is admin-only — no public registration endpoint

---

## Future Modules

The schema already includes placeholder tables for:

| Module | Table | Status |
|---|---|---|
| Attendance | `attendance_events` | Schema ready, UI pending |
| Leave / Vacations | `leave_requests` | Schema ready, UI pending |
| Payroll | — | Planned |
| Notifications | — | Planned |
