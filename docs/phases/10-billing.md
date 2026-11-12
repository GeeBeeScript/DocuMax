# Phase 10 — Billing & usage limits

**Goal:** Stripe subscriptions with a per-plan monthly document cap enforced atomically.

## Scope

- Deps: `stripe`. `lib/billing/plans.ts` (plan ids, caps, seats, Stripe price ids from env).
- Migrations: `subscriptions`, `usage_counters`, `consume_document_quota(org_id)` (atomic upsert-increment; raises
  `quota_exceeded`), `release_document_quota` for failed uploads.
- Checkout session action, Customer Portal action, webhook Route Handler (`checkout.session.completed`,
  `customer.subscription.*`, `invoice.payment_failed`) with signature verification and idempotency.
- `requestUpload` consumes quota before creating the document; bulk upload checks remaining quota upfront.
- UI: billing settings page (plan, usage meter, upgrade/manage), `UsageMeter` in sidebar, over-limit dialog with
  upgrade CTA; seat limits on invites.

## Acceptance criteria

- Cap cannot be exceeded under concurrent uploads.
- Plan changes reflect within seconds of webhook delivery; downgrades apply at period end.
- Only owners manage billing.

## Tests

- Webhook handler with Stripe fixture events (signature verified with test secret).
- Concurrency test on `consume_document_quota` (parallel calls never exceed cap).
- Component tests: `UsageMeter`, over-limit dialog.

## Completion evidence (2026-11-12)

- [x] **Cap cannot be exceeded under concurrent uploads** — 20 parallel `consume_document_quota` calls with 5
      documents left: exactly 5 succeed, the counter ends at 25 (`tests/integration/billing/quota.test.ts`); uploads
      take quota and create the pending document in one transaction; E2E shows the over-limit dialog and that only
      what fits is uploaded.
- [x] **Plan changes reflect within seconds of webhook delivery; downgrades apply at period end** — the webhook updates
      `subscriptions` synchronously (signed fixture events: created, upgraded, out-of-order ignored, cancel at period
      end keeps the plan, deleted → Free); the billing page refreshes live from `subscriptions` (Realtime).
      Downgrade timing is Stripe portal configuration (ADR-023).
- [x] **Only owners manage billing** — checkout/portal actions and `set_stripe_customer()` refuse admins (integration);
      the billing nav item and buttons are owner-only; others see a read-only page.
- [x] Seat limits on invites (trigger + message with upgrade hint; integration + E2E); usage meter in the sidebar and
      on the billing page; over-limit dialog with "upload the first N" and the upgrade CTA.
- [x] Tests: webhook fixtures, concurrency, actions with a mocked Stripe, component tests (UsageMeter, over-limit
      dialog, upload panel's upfront check, plan picker), E2E "free plan: usage meter, over-limit dialog, seat limit,
      billing page".
- [ ] **Needs the owner (not code):** a Stripe account — test-mode keys first — with Pro and Business prices
      (monthly + yearly, `metadata.plan` set), the `STRIPE_*` env vars, and a webhook endpoint pointing at
      `/api/stripe/webhook` (ADR-023). Final prices in `lib/billing/plans.ts` are still placeholders (PRD: TBD).
