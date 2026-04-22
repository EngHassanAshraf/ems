-- Add sites table and link employees to sites
begin;

create table if not exists public.sites (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_sites_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

alter table public.employees
  add column if not exists site_id uuid references public.sites(id) on delete set null;

create index if not exists idx_employees_site on public.employees(site_id);

-- RLS for sites
alter table public.sites enable row level security;

create policy sites_authenticated_all
  on public.sites for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

commit;
