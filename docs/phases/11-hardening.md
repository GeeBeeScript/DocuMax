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
