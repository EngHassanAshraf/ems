# Supabase Storage design (Employee documents)

## Buckets
- **`employee-documents`** (private): all employee documents (contracts, introductions, attachments)

Why private:
- Direct object URLs must not be public.
- Access is granted via **signed URLs** after the requester is authorized to read the corresponding metadata row in `public.documents`.

## Path structure (recommended)

Store objects using a deterministic path that encodes tenant + employee + document identity:

```
company/<company_id>/employee/<employee_id>/document/<document_id>/v<version>/<filename>
```

Examples:
- `company/0f.../employee/aa.../document/11.../v1/contract.pdf`
- `company/0f.../employee/aa.../document/11.../v2/contract_signed.pdf`

## File naming strategy
- Keep the **original filename** for user familiarity, but avoid collisions by nesting under `document/<document_id>/v<version>/`.
- Additionally store metadata on `public.documents`:
  - `mime_type`, `byte_size`, optional `checksum_sha256`
  - `title`/`description` for UX

## Versioning strategy
- Keep each version as a new object path (`v1`, `v2`, ...).
- Update `public.documents.version` for the latest, and optionally link older ones using:
  - `supersedes_document_id`

## Secure access pattern (client)
1. User requests document list:
   - App selects from `public.documents` (RLS enforced).
2. For a document the user can access:
   - App calls `supabase.storage.from(bucket).createSignedUrl(storage_path, ttlSeconds)`
3. App uses signed URL to download/preview.

## Storage authorization (options)
### Option A (recommended for simplicity): signed URLs only
- Keep bucket private.
- Do not rely on storage object policies for read.
- Rely on RLS on `public.documents` to decide who can request a signed URL (via the client after listing metadata).

### Option B: storage object policies (advanced)
Add storage RLS that verifies there is a `public.documents` row with matching `bucket_id` + `storage_path` and the user is authorized via the same logic.

Notes:
- Option B is stricter for direct object listing, but increases policy complexity.
- Option A is usually sufficient when your UI never exposes raw paths outside authorized flows.

## Upload flow (Phase 1)
1. HR/Admin selects employee, picks type/title, chooses file.
2. Create a document metadata row first (to get `document_id` and compute the final path).
3. Upload file to `employee-documents` bucket at `storage_path`.
4. Update metadata row with `byte_size`, `mime_type`, checksum (optional).

## TTL recommendations
- Preview: 60–300 seconds
- Download: 300–900 seconds

