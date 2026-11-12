import { CATEGORIES, type Category } from "./extraction-schema";

/**
 * Extraction prompt. The system prompt is constant (cache-friendly, reviewable); everything document- or
 * org-specific goes in the user message.
 */

const CATEGORY_HINTS: Record<Category, string> = {
  repairs_maintenance: "repairs, servicing, maintenance call-outs",
  materials: "parts, supplies, building materials",
  labor_subcontract: "labor charged separately, subcontractors",
  utilities: "water, power, gas, internet, trash",
  cleaning: "cleaning, janitorial",
  landscaping: "gardening, lawn, snow removal",
  insurance: "insurance premiums",
  taxes_fees: "government taxes, permits, licences, bank fees",
  professional_services: "legal, accounting, consulting, inspections",
  equipment_rental: "rented tools and machinery",
  travel_fuel: "fuel, mileage, parking, travel",
  office_admin: "office supplies, software, postage",
  other: "anything that fits none of the above",
};

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured data from supplier invoices and receipts for a cost-tracking product used by property managers and home-service contractors. The text you receive was read from a PDF or photo (possibly by OCR, so expect typos and odd spacing). Pages are separated by lines like "--- page 2 ---".

Fill every field of the output schema. Each field has a "value" and a "confidence" between 0 and 1.

How to fill values:
- Copy values exactly as printed. Never calculate, add up, round or infer a number that is not printed on the document. If the total is not printed, total.value is null, even if you could compute it from the lines. Downstream code does all arithmetic and checks it.
- Amounts (subtotal, tax amount, total, unit prices, line amounts) are strings with the digits as printed, without currency symbols or thousands separators, using "." as the decimal separator (convert "1.234,56" to "1234.56"). Negative amounts (credits) keep a leading "-".
- tax.rate is the percentage as printed, without the % sign ("8.25"), or null if not printed.
- issueDate is the date the document was issued, whatever it is called on the page ("invoice date", "date", "bill date", "statement date"); dueDate is the payment due date ("due", "payment due", "pay by"). Dates are ISO "YYYY-MM-DD". Convert only when the date is unambiguous; if day and month could be swapped and nothing on the document settles it, give your best reading with confidence at most 0.5.
- currency is the ISO 4217 code ("USD", "EUR", "GBP"). Use a printed code or an unambiguous symbol; if there is no indication at all, null.
- supplier is who issued the document (the seller), never the customer being billed.
- invoiceNumber is the document's own number (invoice / receipt / credit note number), not an order or customer number.
- entityHint is text on the document that identifies the property or job the cost belongs to (a service address, unit, job number or project name), copied as printed. Prefer exact matches to the known names and codes listed in the message. Null if nothing identifies it.
- lineItems: one entry per printed line, in order. Leave lines out only if they are headings or subtotals. quantity is null when not printed.
- category: pick the best fit for the whole document and for each line from this list:
${CATEGORIES.map((c) => `  - ${c}: ${CATEGORY_HINTS[c]}`).join("\n")}
- documentType: invoice, receipt, credit_note, quote, statement (an account statement listing several invoices) or other.

How to set confidence:
- 0.95–1.0: printed clearly and unambiguously.
- 0.7–0.9: readable but with OCR noise, or one plausible reading among few.
- below 0.7: guessed, partly unreadable, or ambiguous.
- For a null value: high confidence if the field is clearly absent, low if it may be present but unreadable.`;

export interface PageInput {
  pageNo: number;
  text: string;
}

export interface ExtractionContext {
  /** "property" or "job" — wording for the entity hint. */
  entityKind: "property" | "job";
  /** Known properties/jobs, to help the model copy a matching hint. */
  entities: { name: string; code: string | null; address: string | null }[];
  /** Suppliers seen before in this org (normalized names), helps with OCR'd supplier names. */
  knownSuppliers?: string[];
}

/** Hard cap on how much org context goes into one request. */
const MAX_CONTEXT_ITEMS = 200;

export function buildUserMessage(pages: readonly PageInput[], context: ExtractionContext): string {
  const noun = context.entityKind === "property" ? "properties" : "jobs";
  const entities = context.entities
    .slice(0, MAX_CONTEXT_ITEMS)
    .map((e) => [e.name, e.code && `code ${e.code}`, e.address].filter(Boolean).join(" · "));
  const suppliers = (context.knownSuppliers ?? []).slice(0, MAX_CONTEXT_ITEMS);

  const parts = [
    `Organization type: tracks costs per ${context.entityKind}.`,
    entities.length
      ? `Known ${noun}:\n${entities.map((e) => `- ${e}`).join("\n")}`
      : `No ${noun} have been set up yet.`,
    suppliers.length ? `Suppliers seen before:\n${suppliers.map((s) => `- ${s}`).join("\n")}` : "",
    "Document text:",
    pages
      .map((p) => `--- page ${p.pageNo} ---\n${p.text.trim() || "(no text found on this page)"}`)
      .join("\n\n"),
  ];
  return parts.filter(Boolean).join("\n\n");
}
