# Runbooks

Operational procedures for production. Commands assume the repository root and production credentials in the
environment (never committed). See [ARCHITECTURE.md](ARCHITECTURE.md) for the moving parts.

## Services and where they run

| Piece                 | Where                                           | Deployed by                                                    |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Web (Next.js)         | Vercel                                          | Vercel Git integration — every push to `main`; previews on PRs |
| Worker (BullMQ)       | Railway or Fly.io, image from GHCR              | `.github/workflows/deploy.yml` → `WORKER_DEPLOY_HOOK`          |
| Database/Auth/Storage | Supabase project                                | Migrations: `deploy.yml` (`supabase db push`)                  |
| Redis                 | Upstash (TLS `rediss://` URL)                   | —                                                              |
| Payments              | Stripe (webhook → `/api/stripe/webhook`)        | Stripe dashboard                                               |
| Errors                | Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) | —                                                              |

Health: `GET /api/health` → `200 {"status":"ok"}` when Supabase and Redis answer, `503` otherwise. Point the uptime
monitor at it.

## Deploy

1. Merge to `main` with CI green (`.github/workflows/ci.yml`: checks + audit, integration, E2E, slow, Lighthouse).
2. `deploy.yml` applies migrations first, then builds and publishes `ghcr.io/<owner>/documax-worker:<sha>` and calls
   the worker's deploy hook. Vercel deploys the web app from the same commit.
3. Migrations are written to be backward compatible with the previous web/worker version (add columns before code
   uses them; drop only after code stopped using them), so the order web/worker/DB doesn't matter for a minute.
4. Check `/api/health`, Sentry for new errors, and one real upload → processed document.

## Rollback

- **Web:** Vercel → Deployments → the previous production deployment → _Promote to production_ (instant).
- **Worker:** redeploy the previous image tag `ghcr.io/<owner>/documax-worker:<previous sha>` in Railway/Fly.
- **Database:** migrations are forward-only. Write a new migration that reverses the change and deploy it; for data
  loss use point-in-time recovery (below). Never edit an applied migration.
- Jobs are idempotent (status-checked in the database), so re-running or re-queuing after a rollback is safe.

## Rotate keys

Rotate on a schedule (90 days) and immediately after any suspected leak. Update the value in the platform's secret
store (Vercel env, Railway/Fly secrets, GitHub Actions secrets), redeploy, then revoke the old one.

| Secret                                     | Where it's used | How                                                                                                                        |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                | worker, webhook | Supabase → Settings → API → roll keys (also rolls the anon key: update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the same deploy) |
| `SUPABASE_DB_PASSWORD`                     | deploy workflow | Supabase → Database → reset password                                                                                       |
| `STRIPE_SECRET_KEY`                        | web             | Stripe → Developers → API keys → roll (keep the old one valid for the overlap)                                             |
| `STRIPE_WEBHOOK_SECRET`                    | web             | Stripe → Webhooks → endpoint → roll signing secret                                                                         |
| `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | worker          | provider console → create new key → deploy → delete old                                                                    |
| `REDIS_URL`                                | web, worker     | Upstash → reset password                                                                                                   |
| `SENTRY_DSN`                               | web, worker     | Sentry → Client Keys → new key → deploy → disable old                                                                      |

## Reprocess failed documents

- One document: its page → _Retry processing_ (members and up).
- Many: `npm run reprocess -- --org <org id> [--since YYYY-MM-DD] [--dry-run]` with production env. Each failed
  document moves back to `queued` (audited as the worker) and gets a new job. Look at the errors first
  (`--dry-run`): an AI provider outage or exhausted credit is fixed by the provider, an unreadable file is not.
- Report rendering: regenerate from the Reports page (a failed report shows its error).

## Backups and restore

- Supabase Pro plan: daily backups + point-in-time recovery (PITR). Verify monthly: restore the latest backup into a
  scratch project, run `npm run test:integration` against it (read-only checks) and compare row counts of
  `organizations`, `records`, `documents`.
- Storage objects are not in database backups: enable bucket versioning or a nightly copy (`supabase storage cp`)
  of `documents/` to cold storage.

## Data retention and deletion

- Owners delete an organization in _Organization → Delete organization_: every object under `{org_id}/` in all
  buckets, then all rows (cascade). Irreversible; Stripe subscriptions must be canceled in the portal first.
- Users leave organizations from _Team_; deleting a user account is done by an operator in Supabase Auth on request.
- Logs carry ids and counts only; Sentry events are scrubbed (`lib/observability/scrub.ts`).
- Signed URLs: uploads and previews 5 minutes, downloads 60 seconds (`createSignedUrl` calls).

## Performance

- Lighthouse budgets run in CI (`lighthouserc.json`: performance ≥ 0.9, TTI < 2.5 s on marketing pages).
- Hot-query indexes: `supabase/migrations/20261120090000_indexes.sql`. To check a slow query, run it with
  `EXPLAIN (ANALYZE, BUFFERS)` in the SQL editor and add a migration.
- Worker: `OCR_WORKERS` (CPU-bound, default 2) and `REPORT_WORKERS` (one Chromium, default 2) per process; scale by
  adding worker instances — BullMQ consumers share the queues.

## Incident checklist

1. `/api/health` and Sentry: which piece is failing?
2. Queue backlog: in Redis, `LLEN bull:process-document:wait` (and `render-report`, `import-csv`).
3. AI provider status / credit (extraction failures say so in the document's error).
4. Communicate in-app if users are affected; reprocess after the fix.
