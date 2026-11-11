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
