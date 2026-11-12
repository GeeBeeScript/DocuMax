# Roadmap

Work proceeds phase by phase. Each phase file defines goal, scope, deliverables, acceptance criteria, required
tests and a Definition of Done (DoD). Update the **Status** column when a phase starts/finishes.

| #   | Phase                                                    | Status     | Depends on |
| --- | -------------------------------------------------------- | ---------- | ---------- |
| 0   | [Foundation & governance](phases/00-foundation.md)       | ✅ Done    | —          |
| 1   | [Design system & marketing site](phases/01-marketing.md) | ✅ Done    | 0          |
| 2   | [Auth, orgs, roles & tenancy](phases/02-tenancy.md)      | ✅ Done    | 0          |
| 3   | [Entities & uploads](phases/03-uploads.md)               | ✅ Done    | 2          |
| 4   | [Text extraction & OCR](phases/04-text-extraction.md)    | ✅ Done    | 3          |
| 5   | [AI extraction](phases/05-ai-extraction.md)              | ✅ Done    | 4          |
| 6   | [Validation, review & audit](phases/06-review.md)        | ✅ Done    | 5          |
| 7   | [Calculations & allocations](phases/07-calculations.md)  | ✅ Done    | 6          |
| 8   | [PDF reports](phases/08-pdf-reports.md)                  | ✅ Done    | 7          |
| 9   | [Exports & imports](phases/09-exports-imports.md)        | ✅ Done    | 7          |
| 10  | [Billing & usage limits](phases/10-billing.md)           | ⏳ Next    | 3          |
| 11  | [Hardening & launch](phases/11-hardening.md)             | ⬜ Planned | all        |

Phases 1 and 2 can run in parallel. Phase 7's `lib/calc` work can begin early (pure code).

## Global Definition of Done (applies to every phase)

- [ ] `npm run check` passes (lint, typecheck, unit tests); integration suite passes from Phase 2 on.
- [ ] Acceptance criteria in the phase file are demonstrably met (screenshots or test evidence in the PR).
- [ ] New tenant tables have RLS + are covered by the isolation suite.
- [ ] UI follows DESIGN_SYSTEM.md; new patterns were added as components (with tests), not inlined.
- [ ] Docs updated (DATA_MODEL, PIPELINE, DESIGN_SYSTEM inventory, ADRs) in the same change.
- [ ] Phase status updated here.
