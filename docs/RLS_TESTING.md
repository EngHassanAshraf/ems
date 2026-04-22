# RLS testing checklist (Supabase)

Use these checks after applying migrations to verify tenant isolation and RBAC.

## Setup (recommended)
- Create two tenants: `companyA`, `companyB`
- Create two users: `userAdminA`, `userHrA`
- Create a third user: `userHrB`
- Add memberships:
  - `userAdminA` -> companyA (admin)
  - `userHrA` -> companyA (hr)
  - `userHrB` -> companyB (hr)

## Expected behaviors
### Tenant isolation
- A user in companyA **cannot** read or write rows in companyB (employees, departments, positions, documents).

### Companies
- Members can `select` their company row.
- Only company admin can `update` the company row.

### Employees
- HR/Admin in companyA can CRUD all employees in companyA.
- HR/Admin in companyA cannot access companyB employees.
- (Future-ready) If an employee row is linked via `employees.auth_user_id`, that user can `select` their own employee row even without HR/Admin role.

### Documents
- HR/Admin in tenant can CRUD documents in tenant.
- (Future-ready) employee-linked user can `select` documents belonging to their employee row.

## Quick SQL probes (run as authenticated users)
In Supabase SQL editor, use the “Run as” (or test via app) with different users.

### Employees list
```sql
select id, company_id, name_ar, status
from public.employees
order by created_at desc
limit 20;
```

### Insert employee (should succeed only for HR/Admin in that company)
```sql
insert into public.employees (company_id, name_ar, status)
values ('<company_uuid>', 'موظف تجريبي', 'active')
returning id, company_id;
```

### Cross-tenant insert (should fail)
```sql
insert into public.employees (company_id, name_ar, status)
values ('<other_company_uuid>', 'محاولة اختراق', 'active');
```

