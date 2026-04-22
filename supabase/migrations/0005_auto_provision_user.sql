-- Auto-provision user profile + company + admin membership on signup
-- Fires as a SECURITY DEFINER trigger on auth.users INSERT,
-- so it runs with superuser privileges and bypasses RLS.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Pin search_path to prevent search_path injection attacks
set search_path = public
as $$
declare
  v_company_id  uuid;
  v_admin_role  uuid;
  v_full_name   text;
  v_company_name_ar text;
  v_slug        text;
begin
  -- Pull metadata passed from the client during signUp()
  v_full_name       := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_company_name_ar := coalesce(new.raw_user_meta_data->>'company_name_ar', 'شركة جديدة');

  -- Build a URL-safe slug from the English name + random suffix to avoid collisions
  v_slug := lower(regexp_replace(v_company_name_en, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(new.id::text, 1, 8);

  -- 1. Create user profile
  insert into public.user_profiles (id, full_name_en, email, is_active)
  values (new.id, v_full_name, new.email, true)
  on conflict (id) do nothing;

  -- 2. Create a company for this user (every signup gets their own tenant)
  insert into public.companies (name_ar, name_en, slug, is_active)
  values (v_company_name_ar, v_company_name_en, v_slug, true)
  returning id into v_company_id;

  -- 3. Look up the admin role id
  select id into v_admin_role
  from public.roles
  where key = 'admin'
  limit 1;

  -- 4. Create company membership — this user is the admin of their company
  insert into public.company_memberships (company_id, auth_user_id, role_id, is_active)
  values (v_company_id, new.id, v_admin_role, true);

  return new;
end;
$$;

-- Drop and recreate so re-running the migration is idempotent
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

commit;
