-- Demo company and departments/positions for local development
-- Run AFTER 001_roles.sql
begin;

-- Demo company
insert into public.companies (id, name_ar, name_en, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'شركة تجريبية',
  'Demo Company',
  'demo'
)
on conflict (slug) do nothing;

-- Departments
insert into public.departments (company_id, name_ar, name_en)
values
  ('00000000-0000-0000-0000-000000000001', 'تقنية المعلومات', 'Information Technology'),
  ('00000000-0000-0000-0000-000000000001', 'الموارد البشرية', 'Human Resources'),
  ('00000000-0000-0000-0000-000000000001', 'المالية', 'Finance'),
  ('00000000-0000-0000-0000-000000000001', 'المبيعات', 'Sales'),
  ('00000000-0000-0000-0000-000000000001', 'العمليات', 'Operations')
on conflict (company_id, name_ar) do nothing;

-- Positions
insert into public.positions (company_id, name_ar)
values
  ('00000000-0000-0000-0000-000000000001', 'مطور برمجيات', 'Software Developer'),
  ('00000000-0000-0000-0000-000000000001', 'مدير مشروع', 'Project Manager'),
  ('00000000-0000-0000-0000-000000000001', 'محاسب', 'Accountant'),
  ('00000000-0000-0000-0000-000000000001', 'مسؤول موارد بشرية', 'HR Officer'),
  ('00000000-0000-0000-0000-000000000001', 'مدير عام', 'General Manager')
on conflict (company_id, name_ar) do nothing;

commit;
