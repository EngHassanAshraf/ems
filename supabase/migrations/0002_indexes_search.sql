-- Optional search indexing (Phase 1)
begin;

-- Employee name search (Arabic/English). Uses pg_trgm.
create extension if not exists pg_trgm;

create index if not exists idx_employees_name_ar_trgm
  on public.employees using gin (name_ar gin_trgm_ops);

commit;

