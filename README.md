# نظام إدارة الموظفين — Employee Manager

Arabic-first (RTL) employee management system built with Next.js, Supabase, and Prisma.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form 7 + Zod 4 |
| i18n | next-intl 4 (Arabic + English, RTL) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 7 |
| Auth | Supabase Auth (JWT, cookie-based sessions) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| Testing | Vitest + fast-check (property-based testing) |

---

## Features

- **Authentication** — login and session management via Supabase Auth
- **Role-based access control** — `super_admin`, `site_admin`, `site_security_manager`
- **Sites** — manage work sites (super_admin only)
- **Job Titles** — manage job title catalog (super_admin only)
- **Employees** — full CRUD with photo upload, site assignment, job title, status (`active` / `fired`)
- **Users** — create and manage system users with role and site assignment (super_admin only)
- **Documents** — upload, open, and download employee documents via Supabase Storage
- **Reports** — active employee count per job title per site (matrix view)
- **Employee Evaluation System** — structured, criteria-based performance scoring
  - Evaluation criteria management (super_admin only)
  - Evaluation form with per-criterion scoring (Excellent / Very Good / Good / Acceptable)
  - Score calculation with weighted average and final grade
  - Evaluation history per employee with result pages
  - Dedicated evaluations page (sidebar) for quick access
  - Full RBAC enforcement — site_security_manager scoped to their site
- **Property-based tests** — 13 correctness properties verified with fast-check

---

## Roles

| Role | Access |
|---|---|
| `super_admin` | Full access — all sites, all employees, criteria/sites/users/job-titles management |
| `site_admin` | Scoped to their site — employee management only, no evaluation access |
| `site_security_manager` | Scoped to their site — can create and view evaluations for their site's employees |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd employee_manager
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

### 3. Apply database migrations

Prisma migrations are in `prisma/migrations/`. Apply them using the direct URL:

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations (uses DIRECT_URL from .env.local)
npx prisma migrate deploy
```

### 4. Set your account as super_admin

After signing up, run in Supabase SQL Editor (replace with your user UUID):

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
npx vitest run     # run all tests
```

---

## Routes

### Public (unauthenticated)

| Route | Description |
|---|---|
| `/login` | Sign-in page |

### Protected (require session)

| Route | Access | Description |
|---|---|---|
| `/dashboard` | All | Stats + recent employees |
| `/employees` | All | Employee list with filters |
| `/employees/[id]` | All | Employee detail, documents, evaluation history |
| `/employees/[id]/evaluate` | super_admin, site_security_manager | Create/edit evaluation |
| `/employees/[id]/evaluations/[evalId]` | super_admin, site_security_manager | Evaluation result |
| `/evaluations` | super_admin, site_security_manager | Evaluation page (employee picker) |
| `/documents` | All | Document browser |
| `/totals` | All | Job title × site matrix |
| `/criteria` | super_admin | Evaluation criteria CRUD |
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
│   │   │   └── [id]/
│   │   │       ├── evaluate/       — evaluation form page
│   │   │       └── evaluations/    — evaluation result page
│   │   ├── evaluations/            — evaluation picker page
│   │   ├── criteria/               — criteria management
│   │   ├── documents/
│   │   ├── totals/
│   │   ├── sites/
│   │   ├── users/
│   │   └── job-titles/
│   ├── (auth)/             — public routes
│   │   └── login/
│   ├── layout.tsx
│   └── page.tsx            — redirects to /dashboard
├── actions/                — Next.js server actions
│   ├── auth.ts
│   ├── employees.ts        — CRUD + avatar upload
│   ├── evaluations.ts      — evaluation CRUD + criteria management
│   ├── documents.ts
│   ├── sites.ts
│   ├── users.ts
│   ├── job-titles.ts
│   └── totals.ts
├── features/               — UI feature modules
│   ├── employees/
│   │   ├── employee-form.tsx       — create/edit with photo upload
│   │   ├── employee-avatar.tsx     — signed-URL avatar component
│   │   ├── edit-employee-button.tsx
│   │   ├── employees-table.tsx
│   │   └── ...
│   ├── evaluations/
│   │   ├── evaluation-form.tsx     — multi-criterion scoring form
│   │   ├── evaluations-client.tsx  — evaluation picker (documents-style)
│   │   ├── employee-eval-card.tsx  — employee identity card for eval pages
│   │   └── criteria-client.tsx     — criteria management UI
│   ├── documents/
│   ├── dashboard/
│   ├── sites/
│   ├── users/
│   ├── job-titles/
│   └── totals/
├── components/
│   ├── layout/             — app shell, sidebar, topbar
│   └── ui/                 — button, input, select, dialog, toast…
└── lib/
    ├── auth/user.ts        — getServerUser(), role helpers
    ├── evaluation/score.ts — pure ScoreCalculator utility
    ├── prisma.ts
    └── supabase/

prisma/
├── schema.prisma           — full schema including evaluation models
└── migrations/             — Prisma migration history

messages/
├── ar.json                 — Arabic translations
└── en.json                 — English translations
```

---

## Database Schema

| Table | Description |
|---|---|
| `user_profiles` | Auth user profiles with `role` and `site_id` |
| `sites` | Work sites |
| `job_titles` | Job title catalog |
| `employees` | Employee records with `avatar_url`, `site_id`, `job_title_id`, `status` |
| `documents` | Document metadata (files in Supabase Storage) |
| `evaluation_criteria` | Reusable evaluation criteria managed by super_admin |
| `employee_evaluations` | Evaluation submissions with computed `total_score` and `final_grade` |
| `employee_evaluation_items` | Per-criterion score entries within an evaluation |

### Evaluation score mapping

| Enum value | Points |
|---|---|
| `EXCELLENT` | 5 |
| `VERY_GOOD` | 4 |
| `GOOD` | 3 |
| `ACCEPTABLE` | 2 |

`final_grade` thresholds: ≥ 4.5 → Excellent, ≥ 3.5 → Very Good, ≥ 2.5 → Good, < 2.5 → Acceptable

---

## Storage

**Bucket:** `employee-documents` (private)

**Contents:**
- Employee documents: `employee/{id}/document/{docId}/v1/{filename}`
- Employee avatars: `employee/{id}/avatar/photo.{ext}`

**Access:** All files served via server-generated signed URLs. Avatars use 1-hour TTL; documents use 5-minute TTL.

---

## Testing

Property-based tests use **fast-check** with **Vitest**. Each property runs 100 iterations minimum.

```bash
npx vitest run src/lib/evaluation        # ScoreCalculator properties (4 properties)
npx vitest run src/actions/__tests__     # Server action properties (13 properties)
```

Key correctness properties verified:
- Score point mapping is total and correct
- Score calculation range invariant [2.0, 5.0]
- Score arithmetic correctness
- Grade assignment consistency
- RBAC enforcement for criteria mutations and evaluations
- Site isolation for site_security_manager
- Evaluation item count matches input
- Scores recomputed on update
- Ordering invariant for evaluation history

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

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — never expose to the browser or commit it
- All storage files are in a **private** bucket — only signed URLs are served
- All RBAC is enforced server-side in server actions — UI state cannot bypass it
- Employee avatars and documents are never publicly accessible
