# Requirements Document

## Introduction

This feature refactors the existing Next.js + Supabase employee management application into a clean, scalable architecture. The refactor eliminates any separate backend, migrates all business logic into Next.js Server Actions and Supabase RLS policies, introduces Prisma ORM as the canonical data modeling and query layer, and replaces the current client-side data-fetching pattern with server-first data flows. The result must remain deployable on Vercel + Supabase with no secrets exposed to the browser.

The application is an internal HR system for a single organisation, supporting employees and employee documents. All authenticated users are trusted internal users with full access to the system.

---

## Glossary

- **System**: The Next.js App Router application as a whole.
- **Server_Action**: A Next.js `"use server"` async function that runs exclusively on the server and is called from Client or Server Components.
- **Prisma_Client**: The generated Prisma ORM client used exclusively in server-side code (Server Actions, Route Handlers, Server Components).
- **Supabase_Auth**: The Supabase authentication service managing user sign-up, sign-in, session tokens, and the `auth.users` table.
- **RLS**: Row Level Security — PostgreSQL policies enforced by Supabase that restrict data access to authenticated users.
- **Authenticated_User**: Any user with a valid Supabase Auth session; all authenticated users have full access to the system.
- **Schema**: The Prisma schema file (`prisma/schema.prisma`) that mirrors the existing Supabase PostgreSQL schema.
- **Migration**: A Supabase SQL migration file under `supabase/migrations/`.
- **Storage**: Supabase Storage used for employee document files.
- **Signed_URL**: A time-limited Supabase Storage URL generated server-side for secure file access.
- **Server_Component**: A Next.js React Server Component that fetches data directly without client-side hooks.
- **Client_Component**: A Next.js React Client Component marked `"use client"` used only for interactivity.
- **i18n**: Internationalisation support via `next-intl` for Arabic (`ar`) and English (`en`) locales.

---

## Requirements

### Requirement 1: Prisma ORM Integration

**User Story:** As a developer, I want all data models defined in a Prisma schema, so that I have a single source of truth for the database structure with type-safe queries.

#### Acceptance Criteria

1. THE Schema SHALL define models for `UserProfile`, `Employee`, `Document`, `AttendanceEvent`, and `LeaveRequest` that match the existing Supabase PostgreSQL schema in `supabase/migrations/0001_init_schema.sql`.
2. THE Schema SHALL use the `postgresql` provider and connect via the `DATABASE_URL` environment variable (Supabase direct connection string).
3. THE Schema SHALL declare all enum types (`EmployeeStatus`, `DocumentType`) matching the PostgreSQL enums already defined in the database.
4. THE Schema SHALL define all foreign key relations with appropriate `onDelete` behaviours matching the existing SQL constraints.
5. THE Prisma_Client SHALL be instantiated as a singleton in `src/lib/prisma.ts` and MUST NOT be imported in any file containing `"use client"`.
6. WHEN the `DATABASE_URL` environment variable is absent at build time, THE System SHALL throw a descriptive error during startup rather than silently failing.
7. THE Schema SHALL use Supabase's direct connection for migrations, ensuring Prisma migrations do not conflict with existing Supabase migrations.

---

### Requirement 2: Server Actions as the Exclusive Mutation Layer

**User Story:** As a developer, I want all data mutations handled by Server Actions, so that no database credentials or business logic are ever exposed to the client.

#### Acceptance Criteria

1. THE System SHALL expose Server Actions for every create, update, and delete operation currently performed in `src/data/employees.ts` and `src/data/documents.ts`.
2. WHEN a Server Action is invoked, THE Server_Action SHALL validate all input using a Zod schema before executing any database query.
3. WHEN input validation fails, THE Server_Action SHALL return a typed error object `{ success: false, error: string }` without throwing an unhandled exception.
4. WHEN a database operation succeeds, THE Server_Action SHALL return `{ success: true, data: T }` where `T` is the Prisma model type.
5. THE Server_Action SHALL call `revalidatePath` or `revalidateTag` after every successful mutation to invalidate the relevant Next.js cache entries.
6. THE System SHALL organise Server Actions into feature modules: `src/actions/employees.ts`, `src/actions/documents.ts`, and `src/actions/auth.ts`.
7. THE Prisma_Client SHALL be the exclusive database query mechanism inside Server Actions; direct Supabase client calls for data queries SHALL NOT appear in Server Actions.

---

### Requirement 3: Supabase Auth Integration

**User Story:** As a user, I want to sign up and sign in using Supabase Auth, so that my session is securely managed across server and client without exposing tokens.

#### Acceptance Criteria

1. THE System SHALL use `@supabase/ssr` to create a server-side Supabase client in Server Components, Server Actions, and middleware that reads and writes session cookies.
2. WHEN a user signs up, THE System SHALL pass `full_name` as `raw_user_meta_data` to `supabase.auth.signUp()`, triggering the existing `handle_new_user` database trigger that auto-provisions a user profile.
3. WHEN a user signs in successfully, THE System SHALL redirect the user to the dashboard page for their locale.
4. WHEN a user signs out, THE System SHALL invalidate the server-side session cookie and redirect to the login page.
5. THE middleware SHALL refresh the Supabase session token on every request and redirect unauthenticated users attempting to access protected routes to the login page.
6. THE System SHALL expose the current user's session exclusively through a server-side helper (`src/lib/supabase/server.ts`) and MUST NOT store auth tokens in `localStorage` or expose them via client-side state.
7. IF a session token is expired and cannot be refreshed, THEN THE middleware SHALL redirect the user to the login page.

---

### Requirement 4: Authentication-Based Access Control

**User Story:** As a system owner, I want access control enforced at the database layer, so that only authenticated users can access the system's data.

#### Acceptance Criteria

1. THE System SHALL apply RLS policies that permit all operations for any authenticated user (`auth.uid() IS NOT NULL`) and deny all access to unauthenticated requests.
2. WHEN the Prisma_Client executes a query, THE System SHALL use a Supabase service-role client in trusted server contexts to ensure queries execute with the correct permissions.
3. THE Server_Action SHALL verify that a valid Supabase Auth session exists before executing any database query; if no session is found, THE Server_Action SHALL return `{ success: false, error: "Unauthorized" }`.
4. THE System SHALL provide a server-side helper function `getServerUser()` in `src/lib/auth/user.ts` that returns the current authenticated user or throws a redirect to the login page if no valid session exists.

---

### Requirement 5: Server-First Data Fetching in Server Components

**User Story:** As a developer, I want pages to fetch data on the server, so that the initial HTML is fully rendered and no client-side loading spinners are needed for primary content.

#### Acceptance Criteria

1. THE System SHALL convert the employees list page, employee detail page, documents page, and dashboard page into Server Components that fetch data using the Prisma_Client directly.
2. WHEN a Server Component fetches data, THE System SHALL use React `Suspense` boundaries with skeleton fallbacks so that the page shell renders immediately while data loads.
3. THE System SHALL remove React Query (`@tanstack/react-query`) as the primary data-fetching mechanism for server-rendered pages; React Query MAY be retained only for client-side optimistic updates and cache invalidation after Server Action mutations.
4. THE System SHALL pass fetched data as props from Server Components to Client Components; Client Components SHALL NOT independently re-fetch data that was already fetched by their parent Server Component.
5. WHEN a Server Component encounters a database error, THE System SHALL render an error boundary fallback rather than crashing the entire page.

---

### Requirement 6: Employee Management

**User Story:** As an authenticated user, I want to create, view, update, and delete employee records, so that the workforce data is always accurate.

#### Acceptance Criteria

1. WHEN an authenticated user submits the employee creation form, THE System SHALL invoke a Server Action that validates the input, inserts a row via Prisma_Client, and returns the created employee.
2. WHEN an authenticated user submits the employee update form, THE System SHALL invoke a Server Action that validates the input, updates the row via Prisma_Client, and returns the updated employee.
3. WHEN an authenticated user confirms employee deletion, THE System SHALL invoke a Server Action that deletes the employee row and all associated documents from both the database and Supabase Storage.
4. THE System SHALL support paginated employee listing with a configurable page size, filtered by optional search query (`name_ar`, `name_en`, `email`) and optional status filter.
5. WHEN the employee list is fetched, THE System SHALL include the related employee fields in the same query to avoid N+1 queries.
6. THE System SHALL display employee status using the existing `EmployeeStatusBadge` component without modification to its interface.
7. IF an employee record is not found for the given `id`, THEN THE System SHALL return a Next.js `notFound()` response.

---

### Requirement 7: Document Management

**User Story:** As an authenticated user, I want to upload, view, and delete employee documents, so that all employee paperwork is stored securely and accessible on demand.

#### Acceptance Criteria

1. WHEN an authenticated user uploads a document, THE System SHALL invoke a Server Action that validates the file metadata, inserts a document row via Prisma_Client, uploads the file to Supabase Storage under the path `employee/{employee_id}/document/{doc_id}/v1/{filename}`, and updates the `storage_path` field.
2. IF the Supabase Storage upload fails, THEN THE Server_Action SHALL delete the previously inserted document metadata row and return `{ success: false, error: string }`.
3. WHEN an authenticated user requests to view or download a document, THE System SHALL generate a Signed_URL server-side with a 300-second TTL and return it to the client; the Storage bucket credentials SHALL NOT be exposed to the client.
4. WHEN an authenticated user deletes a document, THE System SHALL invoke a Server Action that removes the file from Supabase Storage and deletes the document row via Prisma_Client in a single logical operation.
5. THE System SHALL list documents for an employee ordered by `uploaded_at` descending, including `type`, `title`, `byte_size`, and `uploaded_at` fields.
6. THE System SHALL support document types: `introduction`, `contract`, and `attachment`.

---

### Requirement 8: Dashboard Statistics

**User Story:** As an authenticated user, I want to see a summary of workforce statistics on the dashboard, so that I can quickly assess the state of the headcount.

#### Acceptance Criteria

1. THE System SHALL display the total number of employees, the count of active employees, the count of inactive employees, and the count of terminated employees on the dashboard page.
2. WHEN the dashboard page is rendered, THE System SHALL fetch employee statistics via a single Prisma_Client `groupBy` query rather than fetching all employee rows and counting in JavaScript.
3. THE System SHALL render the dashboard statistics inside the existing `StatCard` component without modifying its props interface.

---

### Requirement 9: Internationalisation Preservation

**User Story:** As an Arabic-speaking user, I want the application to continue supporting Arabic and English locales, so that the refactor does not regress the i18n experience.

#### Acceptance Criteria

1. THE System SHALL preserve the existing `[locale]` route segment and `next-intl` configuration without modification.
2. WHEN a Server Action returns an error message key, THE System SHALL return a translation key string (e.g., `"employees.createError"`) rather than a hardcoded English string, so that Client Components can pass it to `useTranslations`.
3. THE System SHALL preserve all existing translation keys in `messages/en.json` and `messages/ar.json`; new keys required by the refactor SHALL be added without removing existing ones.

---

### Requirement 10: Environment Variable and Secret Management

**User Story:** As a developer deploying to Vercel, I want all secrets managed through environment variables with no values hardcoded or exposed to the browser, so that the application is secure in production.

#### Acceptance Criteria

1. THE System SHALL define all required environment variables in `.env.example` with placeholder values and inline comments describing each variable's purpose.
2. THE `DATABASE_URL` variable (Supabase direct Postgres connection string for Prisma) SHALL be classified as a server-only secret and MUST NOT be prefixed with `NEXT_PUBLIC_`.
3. THE `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables SHALL remain as the only Supabase-related variables exposed to the browser.
4. THE System SHALL validate all required environment variables at startup using the existing `src/lib/env.ts` pattern, throwing a descriptive error if any server-side variable is missing.
5. THE Prisma_Client singleton SHALL be initialised with `process.env.DATABASE_URL` and SHALL NOT accept the connection string from any client-accessible source.

---

### Requirement 11: Vercel + Supabase Deployment Compatibility

**User Story:** As a developer, I want the refactored application to deploy successfully on Vercel with Supabase as the backend, so that the production environment is unchanged.

#### Acceptance Criteria

1. THE System SHALL include a `postinstall` or `build` script step that runs `prisma generate` so that the Prisma Client is generated during Vercel's build process.
2. THE System SHALL NOT require any additional infrastructure beyond a Vercel project and a Supabase project (no separate API servers, no Docker containers in production).
3. WHEN deployed to Vercel, THE System SHALL use Supabase's connection pooling URL (via `pgbouncer`) for the `DATABASE_URL` to avoid exhausting Postgres connection limits under serverless concurrency.
4. THE System SHALL remain compatible with the existing `supabase/migrations/` directory structure; Prisma migrations SHALL NOT be used to alter the database schema — Supabase migrations remain the schema source of truth.
5. THE System SHALL pass `next build` without TypeScript errors after the refactor is complete.
