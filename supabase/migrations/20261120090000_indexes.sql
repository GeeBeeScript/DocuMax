-- Phase 11 — index review for hot queries (EXPLAIN on the local database; docs/RUNBOOKS.md → Performance).
--   statements / exports: approved records of an org in an issue-date range (lib/statements/load.ts, lib/export)
create index records_org_status_issue_idx on public.records (org_id, status, issue_date);
--   duplicate candidates: same total in the org (lib/validation/load.ts)
create index records_org_total_idx on public.records (org_id, total_cents);
--   audit log page: newest first by id, optionally by person (features/audit/queries.ts)
create index audit_log_org_id_idx on public.audit_log (org_id, id desc);
create index audit_log_org_actor_idx on public.audit_log (org_id, actor_id, id desc);
