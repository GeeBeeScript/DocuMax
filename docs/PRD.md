# DocuMax — Product Requirements

## One-liner

A business uploads messy paperwork (invoices, receipts, reports, PDFs, notes). AI turns it into structured, checked
data, a person reviews it, and DocuMax produces a polished multi-page PDF statement, report or quote.

## Target customers (equal priority)

| Persona                     | Entity   | Core outcome                                                                         |
| --------------------------- | -------- | ------------------------------------------------------------------------------------ |
| **Property manager**        | Property | Monthly cost statement per property for owners; costs split across units/properties. |
| **Home-service contractor** | Job      | Job cost statement per job; supplier costs feed quotes and job profitability.        |

Both are served by one data model: an org chooses a **mode** (`property` or `job`) at onboarding, which drives labels
(`entityLabels(kind)`), sample data, and default templates. Bookkeepers serving either audience are a secondary persona.

### Roles inside an organization

| Role       | Can                                                                      |
| ---------- | ------------------------------------------------------------------------ |
| `owner`    | Everything incl. billing, deleting the org, transferring ownership       |
| `admin`    | Manage members, entities, templates, settings; everything a reviewer can |
| `reviewer` | Approve / reject / correct extracted records; generate reports           |
| `member`   | Upload documents, view records and reports                               |
| `viewer`   | Read-only                                                                |

## Functional requirements

### R1 Multi-tenancy

- Organizations, users, memberships with roles; a user can belong to several orgs and switch between them.
- Invites by email with a role.
- All data isolated per organization (Postgres RLS + storage policies).
- **Automated tests prove isolation** for every tenant table and storage bucket.

### R2 Uploads

- Single and bulk upload (drag-and-drop, multi-select) of PDF, JPG, PNG, HEIC/WEBP (converted), up to 25 MB each.
- Direct-to-storage upload with progress; optional entity assignment at upload time.
- Preview of PDFs (page thumbnails + viewer) and images.
- Processing status visible live while background jobs run (queued → extracting → analyzing → validating →
  needs review / ready / failed), with retry on failure.

### R3 Text extraction

- Extract the text layer from PDFs.
- OCR fallback for scanned PDFs and images when the text layer is missing or too sparse.

### R4 AI extraction

- AI fills a fixed structure: supplier (name, tax id, address), invoice number, issue/due dates, currency,
  subtotal, tax (amount + rate), total, line items (description, qty, unit price, amount, category), category, and
  suggested entity.
- Output is validated against a zod schema; invalid output is retried, then flagged.
- Each field has a confidence score (0–1).

### R5 Validation & review

- Flag **duplicates** (same file hash, or same supplier + invoice number, or same supplier + date + total).
- Flag **missing required fields**.
- Flag **totals that don't add up** (line items vs subtotal, subtotal + tax vs total), with a tolerance of ±1 cent
  per line for rounding.
- Items with any issue or any field below the confidence threshold go to the **review queue**.
- Reviewers **approve, reject or correct** each item, field by field, side by side with the document preview.
- **Audit log** of every change (who, when, what changed, before/after, reason).

### R6 Calculations

- Totals per entity and period (month by default; custom ranges), per category, per supplier.
- Allocations: a record or line item can be split across entities by percentage or fixed amount.
- Done in ordinary code (`lib/calc`) with unit tests — **never by the AI**.

### R7 PDF reports

- Templates: monthly cost statement (per entity/period), summary report (portfolio/all jobs), quote.
- Org branding: logo, colors, header, footer, page numbers ("Page X of Y").
- Tables continue cleanly across pages (repeated headers, no split rows, carried-forward subtotals).
- Batch generation (e.g. all properties for October) with ZIP download.

### R8 Exports & imports

- CSV and Excel export of records, line items, and statement data (filters respected).
- CSV import of records with column mapping, row validation, preview and an error report; imported rows go through
  the same validation as extracted ones.

### R9 Billing & usage limits

- Plans with a monthly document cap; Stripe subscriptions (Checkout + Customer Portal).
- Usage meter in the app; uploads blocked with a clear upgrade path when the cap is reached.

| Plan (placeholder) | Docs / month | Seats | Price |
| ------------------ | ------------ | ----- | ----- |
| Free               | 25           | 1     | $0    |
| Pro                | 500          | 5     | TBD   |
| Business           | 2,500        | 20    | TBD   |

## Non-functional requirements

- **Security:** RLS everywhere, least-privilege service role, signed URLs (short-lived), no PII in logs.
- **Performance:** page TTI < 2.5s on marketing pages; a typical 1–3 page invoice processed in < 60s p95.
- **Accessibility:** WCAG 2.2 AA; keyboard-complete review flow; reduced-motion respected.
- **Reliability:** jobs are idempotent and retried with backoff; failures visible and retryable in the UI.
- **Design:** Miro-inspired UI (see DESIGN_SYSTEM.md), responsive down to 360px.

## Out of scope (v1)

Accounting-system sync (QuickBooks/Xero), email-in ingestion, mobile apps, multi-currency conversion, SSO/SAML.
These are candidates for post-launch phases.
