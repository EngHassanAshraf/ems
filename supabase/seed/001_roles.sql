begin;

insert into public.roles (key, name_ar, name_en)
values
  ('admin', 'مسؤول', 'Admin'),
  ('hr', 'الموارد البشرية', 'HR'),
  ('employee', 'موظف', 'Employee')
on conflict (key) do nothing;

commit;

