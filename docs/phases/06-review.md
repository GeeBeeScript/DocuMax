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
