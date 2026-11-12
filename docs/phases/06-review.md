# Phase 6 — Validation, review queue & audit log

**Goal:** catch errors automatically and give reviewers a fast, keyboard-friendly way to approve, reject or correct.

## Scope

- `lib/validation/*`: rules from [DOCUMENT_PIPELINE.md](../DOCUMENT_PIPELINE.md) (duplicates, missing fields,
  total/line mismatches, low confidence, suspicious dates, no entity) + `normalize.ts`. Pure, shared client/server.
- Migrations: `validation_issues`, `review_actions`; org setting `review_threshold`, `auto_approve`.
- Worker stage 3 + routing (stage 4).
- Review queue page: `DataTable` with filters (issue code, entity, supplier, confidence), counts by issue.
- Review screen: split view — `DocumentPreview` (with highlighted page) | field form with `ConfidencePill`,
  `IssueBanner`s, line-item editor; live re-validation on edit; approve / reject (with reason) / save corrections;
  keyboard shortcuts; "next item" flow.
- Bulk approve for clean items (role ≥ reviewer).
- Audit log viewer (per record timeline + org-wide filterable log for admins), diff rendering.

## Acceptance criteria

- Every rule produces the documented issue; corrected values clear issues immediately.
- Every approve/reject/correct is recorded in `review_actions` and `audit_log` with actor and before/after.
- Reviewer can process a clean item in ≤ 2 keystrokes.

## Tests

- One unit test file per validation rule (positive, negative, tolerance edges).
- Action tests: role enforcement, audit rows written, status transitions.
- Component tests: review form, issue banners, shortcuts. E2E: review and approve a flagged document.

## Completion evidence (2026-11-12)

- [x] **Every rule produces the documented issue** — one unit test file per rule in `lib/validation/rules/*.test.ts`
      (positive, negative, tolerance edges); worker integration tests store `no_entity`, `total_mismatch`,
      `duplicate`, `duplicate_file` from real pipeline runs.
- [x] **Corrected values clear issues immediately** — in the browser (live re-validation; component test "fixing the
      total clears the banner", E2E: typing the missing currency removes its error) and on save (integration test:
      the stored issues are the server's re-validation).
- [x] **Every approve/reject/correct is recorded** in `review_actions` (actor, field, before/after, reason) and
      `audit_log` (actor + diff) — `tests/integration/actions/review-actions.test.ts`; visible per record (History) and
      org-wide (Audit log, E2E asserts "Currency: (empty) → USD").
- [x] **A clean item takes ≤ 2 keystrokes** — one: `A` approves and opens the next item (component test + E2E).
- [x] Queue with filters (issue code / clean, entity, supplier, confidence) and counts by issue; bulk approve of clean
      items (role ≥ reviewer, re-checked in the database).
- [x] Review screen: preview opened on the flagged value's page | form with confidence pills, issue banners,
      line-item editor; approve / reject (reason) / save corrections / reopen; shortcuts `A R E J K Esc ? Ctrl+S`.
- [x] Org settings `review_threshold` + `auto_approve` (Review settings page, owners/admins).
- [x] Tests: `npm run check` (unit + component: 362), integration 286 (incl. isolation suite for
      `validation_issues` / `review_actions`), E2E 14 incl. "review, correct and approve a flagged document".
- [x] Decisions recorded in ADR-019.
