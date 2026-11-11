# Data Model

Conventions: `id uuid primary key default gen_random_uuid()`, `created_at`/`updated_at timestamptz`, snake_case.
Every **tenant table** has `org_id uuid not null references organizations(id) on delete cascade`, an index on
`org_id`, RLS enabled, and the audit trigger (where marked ✎). Money columns are `bigint` **cents** with a sibling
`currency char(3)`. Enumerations are Postgres enums or `text` + check constraint.

## Identity & tenancy

| Table           | Key columns                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations` | `name`, `slug` (unique), `entity_kind` (`property`\|`job`), `logo_path`, `brand_color`, `default_currency`, `review_threshold numeric default 0.85` ✎ |
| `profiles`      | `id = auth.users.id`, `full_name`, `avatar_path`, `last_org_id`                                                                                       |
| `memberships`   | `org_id`, `user_id`, `role` (`owner`\|`admin`\|`reviewer`\|`member`\|`viewer`), unique(org_id,user_id) ✎                                              |
| `invites`       | `org_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at` ✎                                                                                |

## Entities

| Table      | Key columns                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `entities` | `org_id`, `kind` (`property`\|`job`), `name`, `code`, `address`, `client_name`, `status` (`active`\|`archived`), `meta jsonb` ✎ |

## Documents & extraction

| Table               | Key columns                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents`         | `org_id`, `uploaded_by`, `entity_id?`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `sha256`, `page_count`, `status`, `error`, `attempts` ✎                                                                                                                                                                                                |
| `document_pages`    | `org_id`, `document_id`, `page_no`, `text`, `source` (`text_layer`\|`ocr`), `ocr_confidence`                                                                                                                                                                                                                                                          |
| `extractions`       | `org_id`, `document_id`, `model`, `provider`, `schema_version`, `raw jsonb`, `fields jsonb` (value+confidence per field), `latency_ms`, `tokens_in/out`                                                                                                                                                                                               |
| `records`           | `org_id`, `document_id?`, `import_id?`, `entity_id?`, `supplier_name`, `supplier_tax_id`, `invoice_number`, `issue_date`, `due_date`, `currency`, `subtotal_cents`, `tax_cents`, `tax_rate`, `total_cents`, `category`, `status` (`needs_review`\|`approved`\|`rejected`), `min_confidence`, `field_confidence jsonb`, `approved_by`, `approved_at` ✎ |
| `line_items`        | `org_id`, `record_id`, `position`, `description`, `quantity numeric`, `unit_price_cents`, `amount_cents`, `category`, `confidence` ✎                                                                                                                                                                                                                  |
| `validation_issues` | `org_id`, `record_id`, `code` (`duplicate`\|`missing_field`\|`total_mismatch`\|`low_confidence`\|…), `severity` (`error`\|`warning`), `field`, `message`, `details jsonb`, `resolved_at`, `resolved_by`                                                                                                                                               |
| `review_actions`    | `org_id`, `record_id`, `actor_id`, `action` (`approve`\|`reject`\|`correct`), `field`, `before`, `after`, `reason`                                                                                                                                                                                                                                    |

### Document status machine

```
uploading → queued → extracting → analyzing → validating → needs_review
                                                         ↘ ready
                 (any) → failed  (retryable → queued)
```

`records.status`: `needs_review` → `approved` | `rejected` (reviewers may reopen → `needs_review`).

## Allocations & reporting

| Table              | Key columns                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `allocations`      | `org_id`, `record_id`, `line_item_id?`, `entity_id`, `method` (`percent`\|`amount`), `percent_bp` (basis points), `amount_cents` ✎       |
| `report_templates` | `org_id?` (null = system), `kind` (`statement`\|`summary`\|`quote`), `name`, `config jsonb` ✎                                            |
| `reports`          | `org_id`, `template_id`, `entity_id?`, `period_start`, `period_end`, `status`, `storage_path`, `page_count`, `batch_id?`, `generated_by` |
| `report_batches`   | `org_id`, `period_start`, `period_end`, `status`, `zip_path`, `total`, `completed`                                                       |

Allocation rule: an unallocated record belongs 100% to its `entity_id`. Allocated amounts are computed by
`lib/calc/allocate.ts` (largest-remainder) so splits always sum exactly to the source amount.

## Imports & exports

| Table     | Key columns                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `imports` | `org_id`, `storage_path`, `mapping jsonb`, `status`, `rows_total`, `rows_ok`, `rows_failed`, `error_report_path` |

## Billing & usage

| Table            | Key columns                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscriptions`  | `org_id` (unique), `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_start/end`                                          |
| `usage_counters` | `org_id`, `period_start`, `documents_used`; unique(org_id, period_start). Incremented by `consume_document_quota(org_id)` (atomic, raises when over cap) |

Plan caps are defined in code (`lib/billing/plans.ts`) and mirrored in Stripe price metadata.

## Audit

| Table       | Key columns                                                                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_log` | `org_id`, `actor_id` (from `auth.uid()` or `app.actor_id` setting for worker), `table_name`, `row_id`, `action` (`insert`\|`update`\|`delete`), `before jsonb`, `after jsonb`, `diff jsonb`, `created_at`. Append-only: no update/delete policies. |

The generic trigger `audit_row_change()` is attached to every ✎ table. The worker sets
`set_config('app.actor_id', <system-or-user>, true)` inside its transactions so automated changes are attributed.
