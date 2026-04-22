-- Storage bucket for employee documents (private)
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

-- RLS: any authenticated user can manage documents in this bucket
-- (app-level authorization is enforced in server actions)
create policy "authenticated can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents');

create policy "authenticated can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents');

create policy "authenticated can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'employee-documents');

create policy "authenticated can update"
  on storage.objects for update to authenticated
  using (bucket_id = 'employee-documents');

commit;
