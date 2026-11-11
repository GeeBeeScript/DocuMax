# Multi-tenancy & Isolation

Isolation is enforced **in the database**, not just in application code. App-level checks are defense in depth.

## Model

- A user can be a member of many organizations (`memberships`). The active org is chosen in the UI and stored in
  `profiles.last_org_id`; it is **never trusted for authorization** — RLS checks membership on every row.
- Every tenant table has `org_id` and RLS enabled with `force row level security`.

## Helper functions (Phase 2 migration)

```sql
create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

create function public.has_org_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.role::text = any(p_roles));
$$;
```

## Policy pattern (copy for every tenant table)

```sql
alter table public.<t> enable row level security;
alter table public.<t> force row level security;

create policy "<t>_select" on public.<t> for select using (public.is_org_member(org_id));
create policy "<t>_insert" on public.<t> for insert with check (public.has_org_role(org_id, array['owner','admin','reviewer','member']));
create policy "<t>_update" on public.<t> for update using (public.has_org_role(org_id, array[...]))
                                                 with check (public.has_org_role(org_id, array[...]));
create policy "<t>_delete" on public.<t> for delete using (public.has_org_role(org_id, array['owner','admin']));
```

Role matrix per table is documented in the migration header comment. `with check` on update must also prevent moving
a row to another org (the `org_id` column is immutable — enforced by a trigger `prevent_org_change()`).

## Storage

- Private buckets: `documents`, `reports`, `imports`, `branding`.
- Object path always starts with the org id: `{org_id}/documents/{document_id}/{file_name}`.
- Storage policies use `public.is_org_member(((storage.foldername(name))[1])::uuid)`.
- Downloads use short-lived signed URLs (≤ 5 min) created server-side after an RLS-checked row lookup.

## Service role rules (worker, webhooks, tests)

1. Only `lib/supabase/admin.ts` creates a service-role client.
2. Never import it from Client Components or user-facing Server Actions.
3. Use the org-scoped repository (`lib/db/org-scope.ts`, Phase 2): `forOrg(orgId).from("documents")…` which injects
   `.eq("org_id", orgId)` and asserts returned rows' `org_id`.
4. The `orgId` comes from the validated job payload, and the worker verifies the target row belongs to that org
   before doing any work.

## Isolation test suite (required — Phase 2 onwards)

Location: `tests/integration/tenancy/`. Runs against local Supabase (`npx supabase start`) with `npm run test:integration`.

Setup: create **Org A** (user A, owner) and **Org B** (user B, owner) + a viewer in A; seed one row per tenant table
for each org via the service role.

For **every** tenant table — discovered automatically by querying `information_schema.columns` for tables in
`public` that have an `org_id` column (so new tables are covered without editing the test) — assert:

| #   | As user A, against Org B's data       | Expected                 |
| --- | ------------------------------------- | ------------------------ |
| 1   | `select` all rows                     | 0 rows of Org B returned |
| 2   | `select` by Org B row id              | empty                    |
| 3   | `insert` row with `org_id = B`        | RLS violation            |
| 4   | `update` Org B row                    | 0 rows affected          |
| 5   | `delete` Org B row                    | 0 rows affected          |
| 6   | `update` own row setting `org_id = B` | rejected                 |

Plus: RLS is enabled + forced on every discovered table (fails if someone forgets), anonymous users see nothing,
viewer cannot write, storage objects under `{B}/…` cannot be listed/downloaded/uploaded by user A, Realtime
subscriptions by user A receive no Org B events, and the worker's `forOrg()` helper throws on cross-org rows.

A table may be exempted only via an explicit allowlist in the test with a comment explaining why (e.g.
`report_templates` system rows with `org_id is null` are readable by all).
