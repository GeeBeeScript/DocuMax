# Phase 11 — Hardening & launch

**Goal:** production readiness.

## Scope

- E2E suite (Playwright): full happy path (sign up → org → upload → review → approve → statement → download),
  role restrictions, billing upgrade (Stripe test mode).
- Observability: Sentry (web + worker), pino logs, BullMQ dashboard (admin-only) or metrics, `/api/health`.
- Security: rate limiting (uploads, auth, actions) via Upstash Ratelimit; security headers/CSP; signed URL TTL
  review; dependency audit; run the `security-review` skill; secrets rotation doc.
- Performance: Lighthouse budgets in CI; worker concurrency tuning; DB indexes review (`explain analyze` on hot
  queries); image optimization.
- CI/CD (GitHub Actions): lint/typecheck/unit, integration with Supabase CLI, e2e on preview deploys, migration
  apply on main, worker image build + deploy.
- Data retention + account deletion (org delete cascades storage), backups verified.
- Legal pages (terms, privacy), cookie banner if analytics added.

## Acceptance criteria

- All suites green in CI; zero high/critical audit findings.
- Error in worker/web reaches Sentry with org/job context (no PII).
- Documented runbooks: deploy, rollback, rotate keys, reprocess failed documents.

## Completion evidence (2026-11-12)

- [x] **All suites green; zero high/critical audit findings.** Locally: `npm run check` (454 unit/component
      tests), `npm run test:integration` (386), E2E (19, incl. the full happy path and a viewer's read-only view).
      CI runs every suite plus `audit-ci` on production dependencies (`.github/workflows/ci.yml`). The only
      allowlisted advisories are the four postcss GHSAs inside `next@15.5.x`, with reasons (ADR-024); upgrading to
      Next 16 removes them.
- [x] **Errors reach Sentry with org/job context, no PII.** `scrubEvent` (unit-tested) strips user data, cookies,
      headers, bodies, query strings, breadcrumbs and email addresses; requests are tagged with the org id; failed
      worker jobs are reported with queue / job id / org id / final attempt (`worker/observability.test.ts`, fake
      transport). Off unless a DSN is set.
- [x] **Runbooks:** deploy, rollback, key rotation, reprocessing failed documents (`npm run reprocess`), backups,
      retention, incidents — [RUNBOOKS.md](../RUNBOOKS.md).
- [x] Security: CSP + security headers, Redis rate limits (auth per hashed IP; uploads, imports, reports, invites,
      billing per user), signed-URL TTLs reviewed (5 min / 60 s), `security-review` run — its three findings
      (quota bypass via direct `documents` inserts, seat bypass by rewriting invites, open redirect in `safeNext`)
      are fixed in `20261121090000_security_fixes.sql` + `lib/supabase/middleware.ts` with regression tests.
- [x] Observability: `/api/health` (Supabase + Redis, 200/503), JSON logs, Sentry for web, browser and worker.
- [x] Performance: Lighthouse budgets in CI, hot-query indexes, worker concurrency knobs documented.
- [x] Data lifecycle: owners delete an organization (storage under `{org_id}/` in every bucket, then cascade);
      integration + component tests. Backup verification procedure in the runbook.
- [x] Legal: Terms and Privacy pages (drafts) in the footer and sitemap; no analytics, so no cookie banner.
- [ ] **Needs the owner (not code):** production accounts and secrets (Vercel, Railway/Fly, Supabase project,
      Upstash, Sentry DSN, Stripe — see Phase 10), GitHub Actions secrets for `deploy.yml`, legal review of the
      Terms and Privacy drafts, and the decision to upgrade to Next 16.
