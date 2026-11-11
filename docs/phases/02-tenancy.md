# Phase 2 — Auth, organizations, roles & tenancy

**Goal:** secure multi-tenant foundation with **automated proof of isolation**, plus the Miro-style app shell.

## Scope

- Migrations: `organizations`, `profiles`, `memberships`, `invites`, `audit_log`; enums; helper functions
  `is_org_member`, `has_org_role`; `prevent_org_change()` and `audit_row_change()` triggers; storage buckets +
  policies. Generate `lib/supabase/database.types.ts`.
- Supabase Auth (email + password, magic link; Google OAuth optional), `middleware.ts` session refresh, protected
  `/app` route group.
- Onboarding: create org → choose mode (`property` | `job`) → invite teammates (optional).
- Org switcher, members page (invite, change role, remove), accept-invite flow.
- `lib/auth/` helpers: `getUser()`, `getActiveOrg()`, `assertRole(org, roles)`; `ActionResult` type.
- `lib/db/org-scope.ts`: `forOrg(orgId)` repository helper for the service-role client.
- App shell (`components/app`): `AppSidebar`, `TopBar`, `OrgSwitcher`, `PageHeader`, `EmptyState`; dashboard
  placeholder (card grid) mirroring Miro's dashboard.
- `npm run test:integration` script + `vitest.integration.config.ts` (node env).

## Acceptance criteria

- A user in Org A cannot read/write any Org B data via the API, Storage or Realtime (proved by the suite).
- RLS enabled + forced on every table with `org_id` (test fails otherwise).
- Roles enforced in UI and DB (viewer cannot write; only owner/admin manage members).
- Every insert/update/delete on audited tables produces an `audit_log` row with the actor.

## Tests

- Isolation suite as specified in [MULTI_TENANCY.md](../MULTI_TENANCY.md) (auto-discovers tables).
- Role-matrix tests for memberships/invites actions.
- Audit trigger tests (insert/update/delete capture before/after/actor).
- Component tests for app shell pieces; E2E: sign up → onboarding → dashboard.
