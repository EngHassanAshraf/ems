# Deployment (Vercel + Supabase)

## Environments
### Frontend (Vercel)
Set these in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do **not** expose service keys to the browser.

### Backend (Supabase)
Use Supabase migrations for:
- schema (`supabase/migrations/0001_init_schema.sql`)
- search indexes (`supabase/migrations/0002_indexes_search.sql`)
- RLS (`supabase/migrations/0003_rls_policies.sql`)

Seed roles:
- `supabase/seed/001_roles.sql`

## Recommended workflow
### Local development
- Use Supabase hosted project (fastest start) or Supabase CLI locally.
- Apply migrations early, enable RLS, then build UI features on top.

### CI/CD
- **Vercel** builds Next.js on every push.
- Supabase migrations can be applied via:
  - Supabase CLI in a CI job, or
  - manual promotion from staging → prod using Supabase migration tooling.

## Edge Functions (when to add)
Use Edge Functions when you need:
- bulk imports (CSV → employees)
- cross-cutting workflows (send notifications on document upload)
- server-side privileged operations (using service role key)

Keep simple CRUD in the client using Supabase + RLS.

## Caching approach
- **Client**: React Query cache (staleTime per feature).
- **Server**: Prefer incremental adoption:
  - cache stable lookups (departments/positions) on client
  - avoid caching sensitive per-user datasets on shared layers unless scoped by session/tenant

## Indexing guidance
Already included:
- tenant + status indexes for employees
- employee document indexes
- optional trigram indexes for name search

Add as you grow:
- compound indexes for common filters (department_id + status)
- partial indexes (e.g., `where status='active'`) if workload warrants

## Audit logging (recommended next step)
Add an `audit_log` table capturing:
- actor (`auth_user_id`)
- tenant (`company_id`)
- entity (`table_name`, `row_id`)
- action (`insert`/`update`/`delete`)
- timestamp + diff metadata (JSON)

This can be written via:
- database triggers (strong integrity)
- or app/edge layer (more contextual metadata)

