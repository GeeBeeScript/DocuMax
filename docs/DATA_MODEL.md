# Data Model

Conventions: `id uuid primary key default gen_random_uuid()`, `created_at`/`updated_at timestamptz`, snake_case.
Every **tenant table** has `org_id uuid not null references organizations(id) on delete cascade`, an index on
`org_id`, RLS enabled, and the audit trigger (where marked ✎). Money columns are `bigint` **cents** with a sibling
`currency char(3)`. Enumerations are Postgres enums or `text` + check constraint.

## Identity & tenancy

| Table           | Key columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organizations` | `name`, `slug` (unique), `entity_kind` (`property`\|`job`), `logo_path`, `brand_color`, `default_currency`, `review_threshold numeric default 0.85`, `auto_approve boolean default false` (Phase 6), `timezone text default 'UTC'` (IANA; Phase 7 — decides "this month"), `import_mapping jsonb` (last CSV column mapping; Phase 9), `footer_text` (≤ 200; Phase 8 — printed on every PDF page; with `logo_path` and `brand_color` it is the org's branding), `created_by` ✎ — created only via `create_organization()` |
| `profiles`      | `id = auth.users.id`, `email` (synced from auth), `full_name`, `avatar_path`, `last_org_id` — created by a trigger on `auth.users`                                                                                                                                                                                                                                                                                                                                                                                       |
| `memberships`   | `org_id`, `user_id → profiles`, `role` (`owner`\|`admin`\|`reviewer`\|`member`\|`viewer`), unique(org_id,user_id) ✎ — inserted only by RPCs; always ≥ 1 owner                                                                                                                                                                                                                                                                                                                                                            |
| `invites`       | `org_id`, `email` (lower-case), `role` (never `owner`), `token_hash` (sha256), `invited_by`, `expires_at` (7 days), `accepted_at`; one open invite per email ✎                                                                                                                                                                                                                                                                                                                                                           |

## Entities

| Table      | Key columns                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities` | `org_id`, `kind` (`property`\|`job`, always = the org's `entity_kind`, set by trigger), `name`, `code` (unique per org, case-insensitive), `address`, `client_name`, `status` (`active`\|`archived`), `meta jsonb` ✎ |

## Documents & extraction

| Table               | Key columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents`         | `org_id`, `uploaded_by`, `entity_id?` (same org, trigger-checked), `storage_path` (CHECK `{org_id}/documents/{id}/…`), `file_name`, `mime_type` (PDF/JPEG/PNG/WEBP/HEIC/HEIF), `size_bytes` (≤ 25 MB), `sha256`, `page_count`, `status`, `error`, `attempts` ✎ — users may update only `entity_id`/`file_name`                                                                                                                                                                                 |
| `document_pages`    | `org_id`, `document_id`, `page_no` (unique per document), `text`, `source` (`text_layer`\|`ocr`), `ocr_confidence` (0–1, set iff OCR) — members read; written only by the worker via `save_document_pages()`                                                                                                                                                                                                                                                                                   |
| `extractions`       | `org_id`, `document_id`, `provider`, `model`, `schema_version`, `raw jsonb` (last model output), `fields jsonb` (validated extraction), `attempts`, `latency_ms`, `tokens_in/out` — one row per successful extraction (append-only log, worker writes)                                                                                                                                                                                                                                         |
| `records`           | `org_id`, `source` (`document`\|`import`), `import_id?`, `document_id?` (unique), `extraction_id?`, `entity_id?`, `document_type`, `supplier_name`, `supplier_tax_id`, `invoice_number`, `issue_date`, `due_date`, `currency`, `subtotal_cents`, `tax_cents`, `tax_rate`, `total_cents`, `category`, `entity_hint`, `status` (`needs_review`\|`approved`\|`rejected`), `min_confidence`, `field_confidence jsonb`, `approved_by`, `approved_at` ✎ — `import_id` arrives with imports (Phase 9) |
| `line_items`        | `org_id`, `record_id`, `position` (unique per record), `description`, `quantity numeric`, `unit_price_cents`, `amount_cents`, `category`, `confidence` ✎                                                                                                                                                                                                                                                                                                                                       |
| `validation_issues` | `org_id`, `record_id`, `code` (`duplicate_file`\|`duplicate`\|`missing_field`\|`total_mismatch`\|`lines_mismatch`\|`line_math`\|`low_confidence`\|`date_suspicious`\|`no_entity`), `severity` (`error`\|`warning`), `field` (column, `lines[i].column` or `entity`), `message`, `details jsonb`, `resolved_at`, `resolved_by` — members read; replaced as a set by `save_validation` / `review_record`; resolved (not deleted) when a record is approved                                       |
| `review_actions`    | `org_id`, `record_id`, `actor_id` (null = DocuMax, e.g. auto-approve), `action` (`approve`\|`reject`\|`correct`\|`reopen`), `field` (one row per corrected field; `line_items` for a line-item replacement), `before`, `after`, `reason` (≤ 1000 chars) — members read (per-record history); written only by the functions below                                                                                                                                                               |

### Document status machine

```
uploading → queued → extracting → analyzing → validating → needs_review
                                                         ↘ ready
                 (any) → failed  (retryable → queued)
```

Status changes go through functions, never a plain UPDATE (Phase 3):

| Function                                                            | Who          | Transition                                                                                                                                  |
| ------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm_document_upload(doc)`                                      | writers      | `uploading → queued` (attempts + 1); idempotent                                                                                             |
| `retry_document(doc)`                                               | writers      | `failed → queued` (attempts + 1)                                                                                                            |
| `transition_document(org, doc, from[], to)`                         | service role | any step, only if current status ∈ `from`; audited as the worker                                                                            |
| `save_document_pages(…)`                                            | service role | `extracting → analyzing` + pages (Phase 4)                                                                                                  |
| `save_extraction(…)`                                                | service role | `analyzing → validating` + extraction log, record, line items; never overwrites an approved/rejected record (Phase 5)                       |
| `save_validation(org, doc, issues, record_status, document_status)` | service role | `validating → needs_review \| ready` + replaces the record's issues; auto-approve writes an `approve` review action with no actor (Phase 6) |

`records.status`: `needs_review` → `approved` | `rejected` (reviewers may reopen → `needs_review`).

Review functions (Phase 6, `security definer`, role checked inside — owner/admin/reviewer):

| Function                                                                                               | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review_record(record, action, fields?, lines?, issues?, reason?)`                                     | One call per review step. `correct` (and any approve/reject carrying edits): editable columns only, one `review_actions` row per changed field with before/after, corrected fields' confidence → 1, `min_confidence` recomputed, entity copied to the document, issues replaced with the server's re-validation. `approve` needs a reason while error issues remain; `reject` always needs one; both resolve the issues and set the document `ready`. `reopen` (approved/rejected → `needs_review`) moves the document back to `needs_review`. A decided record must be reopened before it can change. |
| `bulk_approve_clean(records[])`                                                                        | Approves the given records that are awaiting review **and** have no unresolved issues; returns the count. Reason recorded: "Bulk approval (no issues)".                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `replace_record_issues(org, record, issues)`, `record_min_confidence(field_confidence, document_type)` | Internal helpers (not callable by clients).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

`records` is in the `supabase_realtime` publication (RLS applies), ready for live queue updates (the Phase 6 UI refreshes on navigation and after each action).

## Allocations & reporting

| Table            | Key columns                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allocations`    | `org_id`, `record_id`, `line_item_id?` (null = the whole record), `entity_id` (same org; `on delete restrict`), `method` (`percent`\|`amount`), `percent_bp` (0–10 000) xor `amount_cents` (printed sign), `created_by`; unique (record, line, entity) — members read; written only by `set_allocations()` (owner/admin/reviewer) ✎                                                                              |
| `reports`        | `org_id`, `kind` (`statement`\|`summary`\|`quote`), `entity_id?` (none for summaries), `period_start`, `period_end`, `params jsonb` (quotes: `number`, `markupBp`, `taxRateBp`, `issueDate`, `validUntil`, `notes`), `status` (`queued`→`rendering`→`ready`\|`failed`), `file_name`, `storage_path` (`{org_id}/reports/{id}.pdf`), `page_count`, `byte_size`, `error`, `attempts`, `batch_id?`, `generated_by` ✎ |
| `report_batches` | `org_id`, `kind`, `period_start`, `period_end`, `status` (`running`→`zipping`→`ready`\|`failed`), `total`, `completed`, `failed`, `zip_path` (`{org_id}/batches/{id}.zip`), `error`, `created_by` ✎                                                                                                                                                                                                              |

Allocation rules (computed in `lib/calc/postings.ts`, ADR-020):

- An unallocated record belongs 100% to its `entity_id` (null = unassigned: counted in the portfolio total, on no
  entity's statement).
- **Record-level** rows split the record **total**: by percent (rows total exactly 10 000 bp), or by fixed amounts
  (≤ the total, same sign) with the remainder staying with `records.entity_id`. Tax is split in proportion to the
  gross shares; each entity's net is spread over the record's lines so category breakdowns stay exact.
- **Line-level** rows split one line the same way; other lines (and any difference between the lines and the
  subtotal) stay with the record's entity; tax follows each entity's net.
- A record uses record-level **or** line-level rows: `set_allocations()` replaces the other kind. Replacing a
  record's line items in review removes its line-level rows (cascade).
- Splits can change while a record awaits review or after approval (they distribute, not alter, the record);
  rejected records can't be split. All shares use largest-remainder rounding, so they sum exactly to the source.

`set_allocations(record, line_item?, method, splits jsonb)` validates (entities in the org, percents = 100%, amounts
≤ source) and replaces the scope atomically; returns the number of rows.

## Imports & exports

| Table     | Key columns                                                                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imports` | `org_id`, `file_name`, `storage_path` (`{org_id}/imports/{uuid}.csv`), `mapping jsonb` (field → CSV header), `approve`, `status` (`uploaded`→`queued`→`processing`→`done`\|`failed`), `rows_total`, `rows_ok`, `rows_failed`, `error_report_path`, `error`, `created_by` ✎ |

Imported records are ordinary `records` with `source = 'import'`, `import_id`, no document, and confidence 1 for
every provided field (typed by a person). Functions: `start_import(import, mapping, approve)` (writers; approve on
import: owner/admin/reviewer; saves the mapping as the org default), `import_records(org, import, actor, rows)` and
`finish_import_record(org, record, issues, approve, actor)` (service role; audited as the importer). Invalid rows
are never inserted — they go to the error report (row, column, message).

## Billing & usage

| Table            | Key columns                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscriptions`  | `org_id` (unique), `stripe_customer_id`, `stripe_subscription_id`, `plan` → `plan_limits`, `billing_interval`, `status` (Stripe's), `current_period_start/end`, `cancel_at_period_end`, `payment_failed_at`, `last_event_at` ✎ — members read; written by the webhook (service role) and `set_stripe_customer()` (owners) |
| `usage_counters` | `org_id`, `period_start` (first day of the org's month, in its time zone), `documents_used`; unique(org_id, period_start) — members read; changed only by the quota functions                                                                                                                                             |
| `plan_limits`    | `plan`, `documents_per_month`, `seats` (null = unlimited) — global, read-only; mirrors `lib/billing/plans.ts` (an integration test fails if they differ)                                                                                                                                                                  |
| `stripe_events`  | `id` (Stripe event id), `type` — global; service role only; makes the webhook idempotent                                                                                                                                                                                                                                  |

| Function                                  | Who                     | Does                                                                                                               |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `org_plan(org)`                           | any member              | The plan while Stripe's status is `active`, `trialing` or `past_due`; otherwise `free`.                            |
| `consume_document_quota(org, n)`          | writers                 | Atomic upsert-increment of this month's counter; raises `quota_exceeded` (hint = remaining) instead of going over. |
| `create_document_upload(…)`               | writers                 | `consume_document_quota` + the pending `documents` row in one transaction — the only way users create documents.   |
| `cancel_document_upload(doc)`             | writers                 | Deletes a still-`uploading` document and releases its quota.                                                       |
| `release_document_quota(org, n, period?)` | service role / internal | Never below zero; not callable by users (they could reset their counter).                                          |
| `org_usage(org)`                          | members                 | Plan, documents used / cap, seats used (members + open invites) / cap, period start.                               |
| `set_stripe_customer(org, customer)`      | owners                  | Stores the Stripe customer created at checkout (never overwrites one).                                             |
| trigger `enforce_seat_limit`              | —                       | New (or reopened) invites are refused (`seat_limit`) when members + open invites would exceed the plan's seats.    |

Plan caps are defined in code (`lib/billing/plans.ts`, used by the UI and pricing page) and mirrored in
`plan_limits` for enforcement in the database; Stripe prices map to plans via `STRIPE_PRICE_*` env ids, with the
price's `metadata.plan` as fallback.

## Audit

| Table       | Key columns                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_log` | `org_id`, `actor_id` (from `auth.uid()` or `app.actor_id` setting for worker), `table_name`, `row_id text`, `action` (`insert`\|`update`\|`delete`), `before jsonb`, `after jsonb`, `diff jsonb`, `created_at`. Append-only: no update/delete policies; readable by owners/admins. No-op updates are not logged. |

The generic trigger `audit_row_change()` is attached to every ✎ table. The worker sets
`set_config('app.actor_id', <system-or-user>, true)` inside its transactions so automated changes are attributed.

## Tenancy functions (Phase 2)

| Function                                         | Purpose                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `is_org_member(org)`, `has_org_role(org, roles)` | RLS helpers (security definer)                                                           |
| `shares_org_with(user)`                          | Profile visibility between teammates                                                     |
| `storage_org_id(path)`                           | `{org_id}/…` prefix → uuid (null if not a uuid) for storage policies                     |
| `create_organization(name, entity_kind)`         | Creates org + owner membership, unique slug, sets `last_org_id`                          |
| `accept_invite(token)`                           | Validates hash/expiry/email and seats, adds membership with the invited role             |
| `invite_preview(token)`                          | Org name, role, email, expired/accepted flags — nothing else (used by `/invite/[token]`) |
| Triggers                                         | `set_updated_at`, `prevent_org_change`, `audit_row_change`, `guard_membership_change`    |

## Report functions (Phase 8)

| Function                                                           | Who                      | Does                                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_report(org, kind, entity?, start, end, params, file_name)` | owner / admin / reviewer | Queues one report (summaries take no entity). Quotes get the next number `Q-YYYY-NNNN` (per org and year, serialized) and `{number}` in the file name is filled in. |
| `create_statement_batch(org, start, end, file_names jsonb)`        | owner / admin / reviewer | One batch + a statement per active entity; names come from the app (`lib/reports/file-names.ts`).                                                                   |
| `report_batch_progress(org, batch)`                                | service role             | Recounts ready / failed reports; returns true exactly once, when the batch moves to `zipping`.                                                                      |

Rendering, storage writes and status updates are the worker's (service role). Templates are code (`pdf/templates`),
not rows — per-org look is the branding columns on `organizations` (ADR-021). `reports` and `report_batches` are
in the realtime publication for live progress.
