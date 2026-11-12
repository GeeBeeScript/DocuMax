import { allocateByWeights } from "./allocate";
import { cents, type Cents } from "./money";
import { inPeriod, periodLabel, type Period } from "./period";
import { postRecord, type CalcRecord, type Posting } from "./postings";
import { addTotals, groupTotals, sumPostings, ZERO_TOTALS, type Totals } from "./totals";

/**
 * View-models for statements (PDF templates, exports, the entity page). Every figure is computed here; templates
 * only format. Rules: only `approved` records count, dated by issue date within the period, in the statement
 * currency (records in other currencies are reported separately, never converted or summed in).
 */

export interface StatementRecord extends CalcRecord {
  status: string;
}

export interface StatementEntity {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  clientName: string | null;
}

export interface StatementLine {
  recordId: string;
  lineId: string | null;
  date: string;
  supplier: string | null;
  invoiceNumber: string | null;
  description: string | null;
  category: string | null;
  net: Cents;
  tax: Cents;
  gross: Cents;
  split: boolean;
}

export interface CategoryRow {
  category: string | null;
  net: Cents;
  tax: Cents;
  gross: Cents;
  /** Share of the statement's gross in basis points (rows sum to exactly 10 000 when gross ≠ 0). */
  shareBp: number;
}

export interface SupplierRow {
  supplier: string | null;
  records: number;
  gross: Cents;
}

export interface OtherCurrency {
  currency: string | null;
  records: number;
  gross: Cents;
}

export interface StatementData {
  org: { name: string };
  entity: StatementEntity;
  period: Period & { label: string };
  currency: string;
  summary: Totals;
  categories: CategoryRow[];
  suppliers: SupplierRow[];
  lines: StatementLine[];
  otherCurrencies: OtherCurrency[];
  generatedAt: string;
}

/** Approved postings dated in the period (any currency). */
export function periodPostings(records: readonly StatementRecord[], period: Period): Posting[] {
  return records
    .filter((r) => r.status === "approved" && inPeriod(r.issueDate, period))
    .flatMap((r) => postRecord(r));
}

function shares(rows: { gross: Cents }[]): number[] {
  const total = rows.reduce((a, r) => a + r.gross, 0);
  if (rows.length === 0 || total === 0) return rows.map(() => 0);
  return allocateByWeights(
    cents(10_000),
    rows.map((r, i) => ({ key: String(i), weight: r.gross })),
  ).map((s) => s.cents);
}

function otherCurrencies(postings: readonly Posting[], currency: string): OtherCurrency[] {
  return groupTotals(
    postings.filter((p) => p.currency !== currency),
    (p) => p.currency,
  ).map((g) => ({ currency: g.key, records: g.totals.records, gross: g.totals.gross }));
}

export function buildStatement(input: {
  org: { name: string };
  entity: StatementEntity;
  period: Period;
  currency: string;
  records: readonly StatementRecord[];
  generatedAt: string;
}): StatementData {
  const all = periodPostings(input.records, input.period).filter((p) => p.entityId === input.entity.id);
  const postings = all.filter((p) => p.currency === input.currency);

  const categoryGroups = groupTotals(postings, (p) => p.category);
  const categoryShares = shares(categoryGroups.map((g) => g.totals));

  return {
    org: input.org,
    entity: input.entity,
    period: { ...input.period, label: periodLabel(input.period) },
    currency: input.currency,
    summary: sumPostings(postings),
    categories: categoryGroups.map((g, i) => ({
      category: g.key,
      net: g.totals.net,
      tax: g.totals.tax,
      gross: g.totals.gross,
      shareBp: categoryShares[i]!,
    })),
    suppliers: groupTotals(postings, (p) => p.supplierName).map((g) => ({
      supplier: g.key,
      records: g.totals.records,
      gross: g.totals.gross,
    })),
    lines: postings
      .map((p) => ({
        recordId: p.recordId,
        lineId: p.lineId,
        date: p.issueDate!,
        supplier: p.supplierName,
        invoiceNumber: p.invoiceNumber,
        description: p.description,
        category: p.category,
        net: p.netCents,
        tax: p.taxCents,
        gross: p.grossCents,
        split: p.split,
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.supplier ?? "").localeCompare(b.supplier ?? "") ||
          a.recordId.localeCompare(b.recordId),
      ),
    otherCurrencies: otherCurrencies(all, input.currency),
    generatedAt: input.generatedAt,
  };
}

export interface PortfolioRow {
  entity: StatementEntity | null;
  totals: Totals;
}

export interface PortfolioData {
  org: { name: string };
  period: Period & { label: string };
  currency: string;
  /** One row per entity with activity (largest first), then unassigned postings if any. */
  rows: PortfolioRow[];
  /** Equals the sum of `rows` — the invariant every summary relies on. */
  total: Totals;
  otherCurrencies: OtherCurrency[];
}

/** All entities for a period: the summary report and the portfolio total. */
export function buildPortfolio(input: {
  org: { name: string };
  entities: readonly StatementEntity[];
  period: Period;
  currency: string;
  records: readonly StatementRecord[];
}): PortfolioData {
  const all = periodPostings(input.records, input.period);
  const postings = all.filter((p) => p.currency === input.currency);
  const byId = new Map(input.entities.map((e) => [e.id, e]));
  const groups = groupTotals(postings, (p) => p.entityId);
  const rows: PortfolioRow[] = [
    ...groups
      .filter((g) => g.key != null)
      .map((g) => ({ entity: byId.get(g.key!) ?? null, totals: g.totals })),
    ...groups.filter((g) => g.key == null).map((g) => ({ entity: null, totals: g.totals })),
  ];
  // Records split across entities count once per entity row, so the total's record count is distinct records.
  const summed = rows.reduce((acc, r) => addTotals(acc, r.totals), ZERO_TOTALS);
  return {
    org: input.org,
    period: { ...input.period, label: periodLabel(input.period) },
    currency: input.currency,
    rows,
    total: { ...summed, records: new Set(postings.map((p) => p.recordId)).size },
    otherCurrencies: otherCurrencies(all, input.currency),
  };
}
