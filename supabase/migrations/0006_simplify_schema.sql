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
as $
declare
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.user_profiles (id, full_name_en, email, is_active)
  values (new.id, v_full_name, new.email, true)
  on conflict (id) do nothing;

  return new;
end;
$;

-- Recreate trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
