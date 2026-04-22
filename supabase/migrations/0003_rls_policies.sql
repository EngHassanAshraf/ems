-- RLS policies (tenant isolation + RBAC + document access)
begin;

-- Helper: check membership in company
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = p_company_id
      and m.auth_user_id = auth.uid()
      and m.is_active = true
  );
$$;

-- Helper: check role key in company
create or replace function public.has_company_role(p_company_id uuid, p_role_key text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_memberships m
    join public.roles r on r.id = m.role_id
    where m.company_id = p_company_id
      and m.auth_user_id = auth.uid()
      and m.is_active = true
      and r.key = p_role_key
  );
$$;

-- Helper: admin OR hr
create or replace function public.is_hr_or_admin(p_company_id uuid)
returns boolean
language sql
stable
as $$
  select public.has_company_role(p_company_id, 'admin')
      or public.has_company_role(p_company_id, 'hr');
$$;

-- Enable RLS
alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.documents enable row level security;
alter table public.attendance_events enable row level security;
alter table public.leave_requests enable row level security;

-- COMPANIES
-- Admin/HR can read the company they belong to; only admin can mutate company metadata (rare).
drop policy if exists companies_select on public.companies;
create policy companies_select
on public.companies
for select
to authenticated
using (public.is_company_member(id));

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using (public.has_company_role(id, 'admin'))
with check (public.has_company_role(id, 'admin'));

-- ROLES
-- Roles are global reference data; readable by authenticated users.
drop policy if exists roles_select on public.roles;
create policy roles_select
on public.roles
for select
to authenticated
using (true);

-- USER_PROFILES
drop policy if exists user_profiles_self_select on public.user_profiles;
create policy user_profiles_self_select
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists user_profiles_self_update on public.user_profiles;
create policy user_profiles_self_update
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists user_profiles_self_insert on public.user_profiles;
create policy user_profiles_self_insert
on public.user_profiles
for insert
to authenticated
with check (id = auth.uid());

-- COMPANY_MEMBERSHIPS
-- HR/Admin can manage memberships within their company; users can read their own memberships.
drop policy if exists memberships_select_self_or_hr on public.company_memberships;
create policy memberships_select_self_or_hr
on public.company_memberships
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.is_hr_or_admin(company_id)
);

drop policy if exists memberships_insert_hr_admin on public.company_memberships;
create policy memberships_insert_hr_admin
on public.company_memberships
for insert
to authenticated
with check (public.is_hr_or_admin(company_id));

drop policy if exists memberships_update_hr_admin on public.company_memberships;
create policy memberships_update_hr_admin
on public.company_memberships
for update
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

drop policy if exists memberships_delete_admin on public.company_memberships;
create policy memberships_delete_admin
on public.company_memberships
for delete
to authenticated
using (public.has_company_role(company_id, 'admin'));

-- DEPARTMENTS / POSITIONS
drop policy if exists departments_select_member on public.departments;
create policy departments_select_member
on public.departments
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists departments_crud_hr_admin on public.departments;
create policy departments_crud_hr_admin
on public.departments
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

drop policy if exists positions_select_member on public.positions;
create policy positions_select_member
on public.positions
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists positions_crud_hr_admin on public.positions;
create policy positions_crud_hr_admin
on public.positions
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

-- EMPLOYEES
-- HR/Admin can manage all employees in tenant.
drop policy if exists employees_crud_hr_admin on public.employees;
create policy employees_crud_hr_admin
on public.employees
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

-- Future: employees can read their own employee row if linked by auth_user_id.
drop policy if exists employees_select_self on public.employees;
create policy employees_select_self
on public.employees
for select
to authenticated
using (auth_user_id = auth.uid());

-- DOCUMENTS
-- HR/Admin: full access in tenant.
drop policy if exists documents_crud_hr_admin on public.documents;
create policy documents_crud_hr_admin
on public.documents
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

-- Future: employees can read documents belonging to them.
drop policy if exists documents_select_self on public.documents;
create policy documents_select_self
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.id = documents.employee_id
      and e.auth_user_id = auth.uid()
  )
);

-- ATTENDANCE_EVENTS (future module; restrict to HR/Admin for now)
drop policy if exists attendance_events_crud_hr_admin on public.attendance_events;
create policy attendance_events_crud_hr_admin
on public.attendance_events
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

-- LEAVE_REQUESTS (future module; restrict to HR/Admin for now; add self-service later)
drop policy if exists leave_requests_crud_hr_admin on public.leave_requests;
create policy leave_requests_crud_hr_admin
on public.leave_requests
for all
to authenticated
using (public.is_hr_or_admin(company_id))
with check (public.is_hr_or_admin(company_id));

commit;

