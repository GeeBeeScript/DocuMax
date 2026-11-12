import { allocateByAmount, allocateByPercent, allocateByWeights, type Share } from "./allocate";
import { cents, type Cents } from "./money";

/**
 * Postings: an approved record turned into the amounts each entity carries — the single source for totals,
 * statements and exports. Pure; all math through lib/calc. Invariants (unit + property tested):
 *   Σ net = total − tax, Σ tax = tax, Σ gross = total, for every record, to the cent.
 *
 * Splits (docs/DATA_MODEL.md → Allocations):
 *   - no allocations → 100% to the record's entity (null = unassigned);
 *   - record-level allocations split the record **total** by percent, or by fixed amounts with the remainder
 *     staying with the record's entity; tax follows the gross shares;
 *   - line-level allocations split individual lines (unallocated lines and any difference between the lines and
 *     the subtotal stay with the record's entity); tax follows each entity's net share.
 *   A record uses either record-level or line-level allocations, never both.
 * Credit notes printed with positive amounts are posted negative.
 */

export interface CalcLine {
  id: string;
  position: number;
  description: string | null;
  category: string | null;
  amountCents: number | null;
}

export interface CalcAllocation {
  lineItemId: string | null;
  entityId: string;
  method: "percent" | "amount";
  percentBp: number | null;
  amountCents: number | null;
}

export interface CalcRecord {
  id: string;
  documentType: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  currency: string | null;
  category: string | null;
  entityId: string | null;
  taxCents: number | null;
  totalCents: number | null;
  lines: readonly CalcLine[];
  allocations: readonly CalcAllocation[];
}

export interface Posting {
  recordId: string;
  /** The line this amount comes from; null = the record as a whole (or the part the lines don't explain). */
  lineId: string | null;
  /** null = not assigned to any entity. */
  entityId: string | null;
  issueDate: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  description: string | null;
  category: string | null;
  currency: string | null;
  netCents: Cents;
  taxCents: Cents;
  grossCents: Cents;
  /** True when the record (or line) was split across entities. */
  split: boolean;
}

/** Key for "no entity" inside allocation maps. */
const NONE = "__none__";
const keyOf = (entityId: string | null) => entityId ?? NONE;
const entityOf = (key: string) => (key === NONE ? null : key);

interface Piece {
  lineId: string | null;
  description: string | null;
  category: string | null;
  net: Cents;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** -1 for a credit note printed with positive amounts (posted as a credit), else 1. */
export function postingSign(record: Pick<CalcRecord, "documentType" | "totalCents">): 1 | -1 {
  return record.documentType === "credit_note" && (record.totalCents ?? 0) > 0 ? -1 : 1;
}

/** Fixed amounts are stored as printed (like the record), so they take the posting sign too. */
function splitBy(
  total: Cents,
  allocs: readonly CalcAllocation[],
  remainderKey: string,
  sign: number,
): Share[] {
  if (allocs[0]!.method === "percent") {
    return allocateByPercent(
      total,
      allocs.map((a) => ({ key: a.entityId, percentBp: a.percentBp ?? 0 })),
    );
  }
  return allocateByAmount(
    total,
    allocs.map((a) => ({ key: a.entityId, amountCents: cents(sign * (a.amountCents ?? 0)) })),
    remainderKey,
  );
}

/** Pieces of the net amount: one per line (when every line has an amount) plus any unexplained difference. */
function pieces(record: CalcRecord, net: Cents, sign: number): Piece[] {
  const lines = [...record.lines].sort((a, b) => a.position - b.position);
  if (lines.length === 0 || lines.some((l) => l.amountCents == null)) {
    return [{ lineId: null, description: null, category: record.category, net }];
  }
  const out: Piece[] = lines.map((l) => ({
    lineId: l.id,
    description: l.description,
    category: l.category ?? record.category,
    net: cents(sign * l.amountCents!),
  }));
  const difference = net - sum(out.map((p) => p.net));
  if (difference !== 0)
    out.push({ lineId: null, description: null, category: record.category, net: cents(difference) });
  return out;
}

/** Split `tax` over posting rows in proportion to their net amounts (exact). */
function withTax(rows: { key: string; piece: Piece; net: Cents; split: boolean }[], tax: Cents) {
  const taxes = allocateByWeights(
    tax,
    rows.map((r, i) => ({ key: String(i), weight: r.net })),
  );
  return rows.map((r, i) => ({ ...r, tax: taxes[i]!.cents }));
}

export function postRecord(record: CalcRecord): Posting[] {
  if (record.totalCents == null) return [];
  const sign = postingSign(record);
  const total = cents(sign * record.totalCents);
  const tax = cents(sign * (record.taxCents ?? 0));
  const net = cents(total - tax);
  const parts = pieces(record, net, sign);
  const home = keyOf(record.entityId);

  const recordAllocs = record.allocations.filter((a) => a.lineItemId == null);
  const lineAllocs = record.allocations.filter((a) => a.lineItemId != null);
  let rows: { key: string; piece: Piece; net: Cents; split: boolean; tax: Cents }[];

  if (lineAllocs.length > 0) {
    // Mode B: each line split by its own allocation; the rest stays home; tax follows net.
    const untaxed = parts.flatMap((piece) => {
      const allocs = piece.lineId ? lineAllocs.filter((a) => a.lineItemId === piece.lineId) : [];
      if (allocs.length === 0) return [{ key: home, piece, net: piece.net, split: false }];
      return splitBy(piece.net, allocs, home, sign).map((s) => ({
        key: s.key,
        piece,
        net: s.cents,
        split: true,
      }));
    });
    rows = withTax(untaxed, tax);
  } else {
    // Mode A: gross shares per entity; tax follows gross; each entity's net is spread over the pieces exactly.
    const split = recordAllocs.length > 0;
    const gross = split ? splitBy(total, recordAllocs, home, sign) : [{ key: home, cents: total }];
    const taxShares = allocateByWeights(
      tax,
      gross.map((g) => ({ key: g.key, weight: g.cents })),
    );
    const remaining = new Map(gross.map((g, i) => [g.key, g.cents - taxShares[i]!.cents]));
    const untaxed = parts.flatMap((piece, index) => {
      const last = index === parts.length - 1;
      const shares = last
        ? [...remaining].map(([key, value]) => ({ key, cents: cents(value) }))
        : allocateByWeights(
            piece.net,
            [...remaining].map(([key, value]) => ({ key, weight: value })),
          );
      for (const s of shares) remaining.set(s.key, remaining.get(s.key)! - s.cents);
      return shares.map((s) => ({ key: s.key, piece, net: s.cents, split }));
    });
    // Tax per row, constrained to each entity's tax share.
    rows = gross.flatMap((g, i) => {
      const mine = untaxed.filter((r) => r.key === g.key);
      if (mine.length === 0) return [];
      const taxes = allocateByWeights(
        taxShares[i]!.cents,
        mine.map((r, j) => ({ key: String(j), weight: r.net })),
      );
      return mine.map((r, j) => ({ ...r, tax: taxes[j]!.cents }));
    });
  }

  return rows
    .filter((r) => r.net !== 0 || r.tax !== 0)
    .map((r) => ({
      recordId: record.id,
      lineId: r.piece.lineId,
      entityId: entityOf(r.key),
      issueDate: record.issueDate,
      supplierName: record.supplierName,
      invoiceNumber: record.invoiceNumber,
      description: r.piece.description,
      category: r.piece.category,
      currency: record.currency,
      netCents: r.net,
      taxCents: r.tax,
      grossCents: cents(r.net + r.tax),
      split: r.split,
    }));
}

export const postRecords = (records: readonly CalcRecord[]): Posting[] => records.flatMap(postRecord);
