import { applyRateBp, cents, sumCents, type Cents } from "./money";
import { periodLabel, type Period } from "./period";
import { periodPostings, type StatementEntity, type StatementRecord } from "./statement";

/**
 * Quote view-model (contractors): a job's approved costs (net of tax) in a period, each marked up by the same rate,
 * then sales tax on the marked-up subtotal. Markup is computed per line and the subtotal is the sum of lines, so the
 * printed lines always add up. Pure; figures only — templates format.
 */

export interface QuoteLine {
  recordId: string;
  lineId: string | null;
  description: string;
  category: string | null;
  cost: Cents;
  markup: Cents;
  price: Cents;
}

export interface QuoteData {
  org: { name: string };
  entity: StatementEntity;
  period: Period & { label: string };
  currency: string;
  number: string;
  issueDate: string;
  validUntil: string;
  markupBp: number;
  taxRateBp: number;
  notes: string | null;
  lines: QuoteLine[];
  costTotal: Cents;
  markupTotal: Cents;
  subtotal: Cents;
  tax: Cents;
  total: Cents;
  generatedAt: string;
}

export function buildQuote(input: {
  org: { name: string };
  entity: StatementEntity;
  period: Period;
  currency: string;
  records: readonly StatementRecord[];
  number: string;
  issueDate: string;
  validUntil: string;
  markupBp: number;
  taxRateBp: number;
  notes?: string | null;
  generatedAt: string;
}): QuoteData {
  if (!Number.isInteger(input.markupBp) || input.markupBp < 0 || input.markupBp > 100_000)
    throw new RangeError("Markup must be between 0% and 1000%.");
  if (!Number.isInteger(input.taxRateBp) || input.taxRateBp < 0 || input.taxRateBp > 10_000)
    throw new RangeError("Tax rate must be between 0% and 100%.");

  const lines: QuoteLine[] = periodPostings(input.records, input.period)
    .filter((p) => p.entityId === input.entity.id && p.currency === input.currency)
    .sort(
      (a, b) => (a.issueDate ?? "").localeCompare(b.issueDate ?? "") || a.recordId.localeCompare(b.recordId),
    )
    .map((p) => {
      const markup = applyRateBp(p.netCents, input.markupBp);
      return {
        recordId: p.recordId,
        lineId: p.lineId,
        description: p.description ?? p.supplierName ?? "",
        category: p.category,
        cost: p.netCents,
        markup,
        price: cents(p.netCents + markup),
      };
    });
  const subtotal = sumCents(lines.map((l) => l.price));
  const tax = applyRateBp(subtotal, input.taxRateBp);
  return {
    org: input.org,
    entity: input.entity,
    period: { ...input.period, label: periodLabel(input.period) },
    currency: input.currency,
    number: input.number,
    issueDate: input.issueDate,
    validUntil: input.validUntil,
    markupBp: input.markupBp,
    taxRateBp: input.taxRateBp,
    notes: input.notes ?? null,
    lines,
    costTotal: sumCents(lines.map((l) => l.cost)),
    markupTotal: sumCents(lines.map((l) => l.markup)),
    subtotal,
    tax,
    total: cents(subtotal + tax),
    generatedAt: input.generatedAt,
  };
}
