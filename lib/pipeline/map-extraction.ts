import type {
  Category,
  DocumentType,
  ExtractedField,
  InvoiceExtractionResult,
} from "@/lib/ai/extraction-schema";
import { parseToCents, type Cents } from "@/lib/calc/money";

/**
 * Stage 2 → rows: validated extraction → `records` + `line_items` values. Pure: no I/O, no model calls.
 * Amounts are parsed from the printed strings by lib/calc (the model never does arithmetic).
 */

export interface PageConfidence {
  source: "text_layer" | "ocr";
  ocrConfidence: number | null;
}

export interface EntityCandidate {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
}

export interface EntityMatch {
  entityId: string;
  score: number;
  by: "code" | "name" | "address";
}

export interface MappedLineItem {
  position: number;
  description: string | null;
  quantity: string | null;
  unit_price_cents: Cents | null;
  amount_cents: Cents | null;
  category: Category | null;
  confidence: number;
}

export interface MappedRecord {
  document_type: DocumentType | null;
  supplier_name: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal_cents: Cents | null;
  tax_cents: Cents | null;
  tax_rate: string | null;
  total_cents: Cents | null;
  category: Category | null;
  entity_hint: string | null;
  entity_id: string | null;
  min_confidence: number;
  field_confidence: Record<string, number>;
}

export interface MappingResult {
  record: MappedRecord;
  lineItems: MappedLineItem[];
  entityMatch: EntityMatch | null;
}

/** Fields that must be present and trusted (docs/DOCUMENT_PIPELINE.md → missing_field / low_confidence). */
export function requiredFields(documentType: DocumentType | null): string[] {
  const base = ["supplier_name", "issue_date", "total_cents", "currency"];
  return documentType === "invoice" ? [...base, "invoice_number"] : base;
}

/**
 * The OCR factor for the document: 1.0 when every page has a text layer, else the lowest OCR page confidence.
 * Fields aren't traced to a page, so the weakest OCR'd page bounds every field (conservative by design).
 */
export function ocrFactor(pages: readonly PageConfidence[]): number {
  const ocr = pages.filter((p) => p.source === "ocr").map((p) => p.ocrConfidence ?? 0);
  return ocr.length ? Math.min(...ocr) : 1;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Combined confidence: min(model confidence, OCR factor). */
export const combine = (model: number, factor: number) => round3(Math.max(0, Math.min(model, factor, 1)));

/** A decimal string for numeric columns (quantity, tax rate) — validated, never converted to float. */
export function parseDecimal(value: string | null): string | null {
  if (value == null) return null;
  const cleaned = value.trim().replace(/%$/, "").replace(",", ".").trim();
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : null;
}

/** Amount field → cents; unparseable printed amounts become null with confidence 0 (validation flags them). */
function amount(field: ExtractedField<string>, factor: number): { cents: Cents | null; confidence: number } {
  if (field.value == null) return { cents: null, confidence: combine(field.confidence, factor) };
  const parsed = parseToCents(field.value);
  return parsed == null
    ? { cents: null, confidence: 0 }
    : { cents: parsed, confidence: combine(field.confidence, factor) };
}

// ---------------------------------------------------------------------------------------------------------------
// Entity matching
// ---------------------------------------------------------------------------------------------------------------

/** Lower-case, accents stripped, punctuation → spaces, common street abbreviations expanded. */
export function normalizeText(text: string): string {
  const abbreviations: Record<string, string> = {
    st: "street",
    rd: "road",
    ave: "avenue",
    av: "avenue",
    blvd: "boulevard",
    dr: "drive",
    ln: "lane",
    ct: "court",
    apt: "apartment",
  };
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => abbreviations[w] ?? w)
    .join(" ");
}

const compact = (text: string) => normalizeText(text).replace(/ /g, "");

/** Dice coefficient over word bigrams-of-characters — robust to word order and small OCR slips. */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = compact(s);
    const out = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  const total = [...ga.values()].reduce((x, y) => x + y, 0) + [...gb.values()].reduce((x, y) => x + y, 0);
  if (total === 0) return 0;
  let overlap = 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  return (2 * overlap) / total;
}

export const ENTITY_MATCH_THRESHOLD = 0.8;

/**
 * Match the document's entity hint to one of the org's properties/jobs: exact code (or code inside the hint) wins;
 * otherwise the best name/address similarity ≥ 0.8. Ambiguous best matches (two within 0.05) return null.
 */
export function matchEntity(hint: string | null, entities: readonly EntityCandidate[]): EntityMatch | null {
  if (!hint || !hint.trim() || entities.length === 0) return null;
  const hintCompact = compact(hint);
  const hintWords = new Set(normalizeText(hint).split(" "));

  for (const e of entities) {
    if (!e.code) continue;
    const code = compact(e.code);
    if (
      code.length >= 2 &&
      (hintCompact === code ||
        hintWords.has(normalizeText(e.code)) ||
        (hintCompact.includes(code) && code.length >= 4))
    ) {
      return { entityId: e.id, score: 1, by: "code" };
    }
  }

  const scored = entities
    .flatMap((e) => [
      { entityId: e.id, score: similarity(hint, e.name), by: "name" as const },
      ...(e.address ? [{ entityId: e.id, score: similarity(hint, e.address), by: "address" as const }] : []),
    ])
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < ENTITY_MATCH_THRESHOLD) return null;
  const runnerUp = scored.find((s) => s.entityId !== best.entityId);
  if (runnerUp && best.score - runnerUp.score < 0.05) return null;
  return { ...best, score: round3(best.score) };
}

// ---------------------------------------------------------------------------------------------------------------

export function mapExtraction(
  extraction: InvoiceExtractionResult,
  {
    pages,
    entities,
    assignedEntityId = null,
  }: {
    pages: readonly PageConfidence[];
    entities: readonly EntityCandidate[];
    assignedEntityId?: string | null;
  },
): MappingResult {
  const factor = ocrFactor(pages);
  const conf = (f: { confidence: number }) => combine(f.confidence, factor);

  const subtotal = amount(extraction.subtotal, factor);
  const tax = amount(extraction.tax.amount, factor);
  const total = amount(extraction.total, factor);
  const taxRate = parseDecimal(extraction.tax.rate.value);

  // A user's assignment at upload time wins over the AI's suggestion.
  const entityMatch = assignedEntityId ? null : matchEntity(extraction.entityHint.value, entities);
  const entityId = assignedEntityId ?? entityMatch?.entityId ?? null;

  const fieldConfidence: Record<string, number> = {
    document_type: conf(extraction.documentType),
    supplier_name: conf(extraction.supplier.name),
    supplier_tax_id: conf(extraction.supplier.taxId),
    invoice_number: conf(extraction.invoiceNumber),
    issue_date: conf(extraction.issueDate),
    due_date: conf(extraction.dueDate),
    currency: conf(extraction.currency),
    subtotal_cents: subtotal.confidence,
    tax_cents: tax.confidence,
    tax_rate: extraction.tax.rate.value != null && taxRate == null ? 0 : conf(extraction.tax.rate),
    total_cents: total.confidence,
    category: conf(extraction.category),
    entity: assignedEntityId
      ? 1
      : entityMatch
        ? round3(Math.min(entityMatch.score, conf(extraction.entityHint)))
        : 0,
  };

  const documentType = extraction.documentType.value;
  const required = requiredFields(documentType);
  const minConfidence = round3(Math.min(...required.map((f) => fieldConfidence[f] ?? 0)));

  const lineItems: MappedLineItem[] = extraction.lineItems.map((line, i) => {
    const unit = amount(line.unitPrice, factor);
    const lineAmount = amount(line.amount, factor);
    const quantity = parseDecimal(line.quantity.value);
    return {
      position: i + 1,
      description: line.description.value,
      quantity,
      unit_price_cents: unit.cents,
      amount_cents: lineAmount.cents,
      category: line.category.value,
      confidence: round3(
        Math.min(
          conf(line.description),
          line.quantity.value != null && quantity == null ? 0 : conf(line.quantity),
          unit.confidence,
          lineAmount.confidence,
        ),
      ),
    };
  });

  return {
    record: {
      document_type: documentType,
      supplier_name: extraction.supplier.name.value,
      supplier_tax_id: extraction.supplier.taxId.value,
      invoice_number: extraction.invoiceNumber.value,
      issue_date: extraction.issueDate.value,
      due_date: extraction.dueDate.value,
      currency: extraction.currency.value,
      subtotal_cents: subtotal.cents,
      tax_cents: tax.cents,
      tax_rate: taxRate,
      total_cents: total.cents,
      category: extraction.category.value,
      entity_hint: extraction.entityHint.value,
      entity_id: entityId,
      min_confidence: minConfidence,
      field_confidence: fieldConfidence,
    },
    lineItems,
    entityMatch,
  };
}
