import { reviewCopy } from "@/content/app";
import { centsToDecimal, parseToCents, type Cents } from "@/lib/calc/money";
import type { RecordForValidation } from "@/lib/validation/types";
import type { Database } from "@/lib/supabase/database.types";
import type { ReviewFields, ReviewLine } from "./schema";

/**
 * The review form's model. Inputs hold strings (what the person typed); `parseDraft` turns them into the values the
 * server action accepts, `changedFields` keeps only what differs from the record, and `liveRecord` builds what
 * lib/validation checks in the browser. Pure — unit-tested without React.
 */

type RecordRow = Database["public"]["Tables"]["records"]["Row"];
type LineRow = Pick<
  Database["public"]["Tables"]["line_items"]["Row"],
  "position" | "description" | "quantity" | "unit_price_cents" | "amount_cents" | "category"
>;

export const DRAFT_FIELDS = [
  "document_type",
  "supplier_name",
  "supplier_tax_id",
  "invoice_number",
  "issue_date",
  "due_date",
  "currency",
  "subtotal_cents",
  "tax_cents",
  "tax_rate",
  "total_cents",
  "category",
  "entity_id",
] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];
export type DraftFields = Record<DraftField, string>;

export interface DraftLine {
  /** Stable React key (lines can be added/removed). */
  key: string;
  description: string;
  quantity: string;
  unit_price_cents: string;
  amount_cents: string;
  category: string;
}
export type DraftLineField = Exclude<keyof DraftLine, "key">;

export interface Draft {
  fields: DraftFields;
  lines: DraftLine[];
}

export type ParsedFields = Required<ReviewFields>;

export interface ParsedDraft {
  fields: ParsedFields;
  lines: ReviewLine[];
  /** Field key (or `lines[i].field`) → message. Empty when everything parses. */
  errors: Record<string, string>;
}

const MONEY = new Set<string>([
  "subtotal_cents",
  "tax_cents",
  "total_cents",
  "unit_price_cents",
  "amount_cents",
]);
const money = (v: number | null) => (v == null ? "" : centsToDecimal(v as Cents));
const decimalString = (v: number | string | null) => (v == null ? "" : String(Number(v)));

let keySeq = 0;
export const newLineKey = () => `line-${++keySeq}`;

export function toDraft(record: RecordRow, lines: readonly LineRow[]): Draft {
  return {
    fields: {
      document_type: record.document_type ?? "",
      supplier_name: record.supplier_name ?? "",
      supplier_tax_id: record.supplier_tax_id ?? "",
      invoice_number: record.invoice_number ?? "",
      issue_date: record.issue_date ?? "",
      due_date: record.due_date ?? "",
      currency: record.currency ?? "",
      subtotal_cents: money(record.subtotal_cents),
      tax_cents: money(record.tax_cents),
      tax_rate: decimalString(record.tax_rate),
      total_cents: money(record.total_cents),
      category: record.category ?? "",
      entity_id: record.entity_id ?? "",
    },
    lines: [...lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        key: newLineKey(),
        description: l.description ?? "",
        quantity: decimalString(l.quantity),
        unit_price_cents: money(l.unit_price_cents),
        amount_cents: money(l.amount_cents),
        category: l.category ?? "",
      })),
  };
}

export const emptyLine = (): DraftLine => ({
  key: newLineKey(),
  description: "",
  quantity: "",
  unit_price_cents: "",
  amount_cents: "",
  category: "",
});

const copy = reviewCopy.item;

/** One input → value. Returns `{ error }` for input that can't be saved. */
function parseValue(key: string, raw: string): { value: string | number | null } | { error: string } {
  const v = raw.trim();
  if (v === "") return { value: null };
  if (MONEY.has(key)) {
    const cents = parseToCents(v);
    return cents == null ? { error: copy.invalidAmount } : { value: cents };
  }
  if (key === "tax_rate" || key === "quantity") {
    const n = v.replace(/%$/, "").replace(",", ".").trim();
    return /^-?\d+(\.\d+)?$/.test(n) ? { value: n } : { error: copy.invalidNumber };
  }
  if (key === "issue_date" || key === "due_date") {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
    return ok ? { value: v } : { error: copy.invalidDate };
  }
  if (key === "currency") {
    const c = v.toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? { value: c } : { error: copy.invalidCurrency };
  }
  return { value: v };
}

export function parseDraft(draft: Draft): ParsedDraft {
  const errors: Record<string, string> = {};
  const fields = {} as Record<DraftField, unknown>;
  for (const key of DRAFT_FIELDS) {
    const result = parseValue(key, draft.fields[key]);
    if ("error" in result) {
      errors[key] = result.error;
      fields[key] = null;
    } else fields[key] = result.value;
  }
  const lines = draft.lines.map((line, i) => {
    const out: Record<string, unknown> = { position: i + 1 };
    for (const key of ["description", "quantity", "unit_price_cents", "amount_cents", "category"] as const) {
      const result = parseValue(key, line[key]);
      if ("error" in result) {
        errors[`lines[${i}].${key}`] = result.error;
        out[key] = null;
      } else out[key] = result.value;
    }
    return out as ReviewLine;
  });
  return { fields: fields as ParsedFields, lines, errors };
}

/** Compare as the database stores it: numeric columns by value, everything else exactly. */
function same(key: string, a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (key === "tax_rate" || key === "quantity") return Number(a) === Number(b);
  return a === b;
}

/** Only the fields that differ from the stored record. */
export function changedFields(record: RecordRow, parsed: ParsedFields): ReviewFields {
  const out: Record<string, unknown> = {};
  for (const key of DRAFT_FIELDS) {
    if (!same(key, record[key], parsed[key])) out[key] = parsed[key];
  }
  return out as ReviewFields;
}

export function linesChanged(original: readonly LineRow[], parsed: readonly ReviewLine[]): boolean {
  if (original.length !== parsed.length) return true;
  const sorted = [...original].sort((a, b) => a.position - b.position);
  return sorted.some((o, i) => {
    const p = parsed[i]!;
    return (["description", "quantity", "unit_price_cents", "amount_cents", "category"] as const).some(
      (k) => !same(k, o[k], p[k]),
    );
  });
}

/** What the browser validates: the record as it would be saved, with edited fields fully confident. */
export function liveRecord(
  record: RecordRow,
  parsed: ParsedDraft,
  changed: ReviewFields,
): RecordForValidation {
  const f = parsed.fields;
  const confidence = { ...((record.field_confidence ?? {}) as Record<string, number>) };
  for (const key of Object.keys(changed)) confidence[key === "entity_id" ? "entity" : key] = 1;
  return {
    id: record.id,
    documentType: f.document_type,
    supplierName: f.supplier_name,
    invoiceNumber: f.invoice_number,
    issueDate: f.issue_date,
    dueDate: f.due_date,
    currency: f.currency,
    subtotalCents: f.subtotal_cents,
    taxCents: f.tax_cents,
    totalCents: f.total_cents,
    entityId: f.entity_id,
    fieldConfidence: confidence,
    lines: parsed.lines.map((l) => ({
      position: l.position,
      quantity: l.quantity,
      unitPriceCents: l.unit_price_cents,
      amountCents: l.amount_cents,
    })),
  };
}

/** DOM id of a field's input, so issues can move focus to it. */
export function fieldInputId(field: string): string {
  const target = field === "entity" ? "entity_id" : field; // issues name the entity "entity"
  return `review-${target.replace(/[[\].]+/g, "-").replace(/-$/, "")}`;
}
