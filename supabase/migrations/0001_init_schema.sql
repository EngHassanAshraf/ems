-- Phase 1 foundation schema (multi-tenant, HR-ready)
-- Assumptions:
-- - Shared schema multi-tenancy via company_id
-- - Roles are per company via company_memberships

begin;

-- Extensions
create extension if not exists "pgcrypto";

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- App user profile (linked to auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name_ar text,
  full_name_en text,
  phone text,
  email text, -- denormalized convenience; source of truth is auth.users
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- Employee status as a constrained domain (enum is okay here; stable + limited)
do $$ begin
  create type public.employee_status as enum ('active', 'inactive', 'terminated');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- Optional link to auth.users for future self-service portals
  auth_user_id uuid unique references auth.users(id) on delete set null,

  -- Core identity
  name_ar text not null,
  email text,
  phone text,
  address text,

  department_id uuid references public.departments(id) on delete set null,
  position_id uuid references public.positions(id) on delete set null,

  hire_date date,
  status public.employee_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_employees_company
  on public.employees(company_id);
create index if not exists idx_employees_company_status
  on public.employees(company_id, status);
create index if not exists idx_employees_department
  on public.employees(department_id);
create index if not exists idx_employees_position
  on public.employees(position_id);
create index if not exists idx_employees_auth_user
  on public.employees(auth_user_id);

create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- Document types (enum for predictable UX + indexing)
do $$ begin
  create type public.document_type as enum ('introduction', 'contract', 'attachment');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,

  type public.document_type not null,
  title text,
  description text,

  storage_bucket text not null default 'employee-documents',
  storage_path text not null, -- e.g. company/<company_id>/employee/<employee_id>/<doc_id>/v1/<filename>

  mime_type text,
  byte_size bigint,
  checksum_sha256 text,

  version int not null default 1,
  supersedes_document_id uuid references public.documents(id) on delete set null,

  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  unique (company_id, storage_path)
);

create index if not exists idx_documents_company_employee
  on public.documents(company_id, employee_id);
create index if not exists idx_documents_employee_type
  on public.documents(employee_id, type);
create index if not exists idx_documents_supersedes
  on public.documents(supersedes_document_id);

create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- Future module placeholders (minimal, non-coupled)
-- Attendance
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null, -- 'check_in' | 'check_out' etc (can evolve to enum later)
  occurred_at timestamptz not null,
  source text, -- device/app/manual
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_attendance_events_company_employee_time
  on public.attendance_events(company_id, employee_id, occurred_at desc);
create trigger trg_attendance_events_updated_at
before update on public.attendance_events
for each row execute function public.set_updated_at();

-- Leave / vacations
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null, -- annual/sick/etc (evolve later)
  start_date date not null,
  end_date date not null,
  status text not null default 'pending', -- pending/approved/rejected
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leave_requests_company_employee_status
  on public.leave_requests(company_id, employee_id, status);
create trigger trg_leave_requests_updated_at
before update on public.leave_requests
for each row execute function public.set_updated_at();

commit;

