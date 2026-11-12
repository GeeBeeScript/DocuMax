import { z } from "zod";
import { parsePercentBp, formatBp } from "@/lib/calc/allocate";
import { parseToCents } from "@/lib/calc/money";
import { isIsoDate } from "@/lib/calc/period";
import { CATEGORIES, DOCUMENT_TYPES } from "@/lib/ai/extraction-schema";
import { documentsCopy } from "@/content/app";
import { unescapeFormula } from "@/lib/export/csv";
import { IMPORT_FIELDS, type ImportField, type ImportMapping } from "./fields";

/**
 * One CSV row → a record to insert, or the problems with it (column + message). Amounts are parsed by lib/calc
 * (never floats); dates must be ISO (YYYY-MM-DD) — "03/04/2026" is ambiguous between US and EU order.
 */

export interface ImportEntity {
  id: string;
  name: string;
  code: string | null;
}

export interface ImportContext {
  entities: readonly ImportEntity[];
  defaultCurrency: string;
}

export const ImportRecordSchema = z.object({
  supplier_name: z.string().min(1).max(200),
  supplier_tax_id: z.string().max(60).nullable(),
  invoice_number: z.string().max(80).nullable(),
  document_type: z.enum(DOCUMENT_TYPES),
  issue_date: z.iso.date(),
  due_date: z.iso.date().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  subtotal_cents: z.number().int().nullable(),
  tax_cents: z.number().int().nullable(),
  tax_rate: z.string().nullable(),
  total_cents: z.number().int(),
  category: z.enum(CATEGORIES).nullable(),
  entity_id: z.uuid().nullable(),
});
export type ImportRecord = z.infer<typeof ImportRecordSchema>;

export interface RowError {
  /** The CSV header (or the field label when the column isn't mapped). */
  column: string;
  message: string;
}

export type RowResult = { ok: true; record: ImportRecord } | { ok: false; errors: RowError[] };

const fold = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const CATEGORY_BY = new Map<string, string>([
  ...CATEGORIES.map((c) => [fold(c), c] as [string, string]),
  ...Object.entries(documentsCopy.record.categories).map(
    ([c, label]) => [fold(label), c] as [string, string],
  ),
]);
const DOCTYPE_BY = new Map<string, string>([
  ...DOCUMENT_TYPES.map((t) => [fold(t), t] as [string, string]),
  ...Object.entries(documentsCopy.record.documentTypes).map(
    ([t, label]) => [fold(label), t] as [string, string],
  ),
]);
const LABEL = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label])) as Record<ImportField, string>;
const LIMITS: Partial<Record<ImportField, number>> = {
  supplier_name: 200,
  supplier_tax_id: 60,
  invoice_number: 80,
};

export function parseRow(row: Record<string, string>, mapping: ImportMapping, ctx: ImportContext): RowResult {
  const errors: RowError[] = [];
  const column = (f: ImportField) => mapping[f] ?? LABEL[f];
  const raw = (f: ImportField) => {
    const header = mapping[f];
    if (!header) return "";
    return unescapeFormula((row[header] ?? "").trim());
  };
  const fail = (f: ImportField, message: string) => errors.push({ column: column(f), message });

  const text = (f: ImportField, required = false): string | null => {
    const v = raw(f);
    if (!v) {
      if (required) fail(f, `${LABEL[f]} is required.`);
      return null;
    }
    const max = LIMITS[f];
    if (max && v.length > max) fail(f, `Keep it under ${max} characters.`);
    return v;
  };
  const date = (f: ImportField, required = false): string | null => {
    const v = raw(f).slice(0, 10);
    if (!v) {
      if (required) fail(f, `${LABEL[f]} is required.`);
      return null;
    }
    if (!isIsoDate(v)) fail(f, `"${raw(f)}" isn't a date like 2026-10-14.`);
    return v;
  };
  const money = (f: ImportField, required = false): number | null => {
    const v = raw(f);
    if (!v) {
      if (required) fail(f, `${LABEL[f]} is required.`);
      return null;
    }
    const cents = parseToCents(v);
    if (cents == null) fail(f, `"${v}" isn't an amount like 1260.57.`);
    return cents;
  };

  const supplier = text("supplier_name", true);
  const totalCents = money("total_cents", true);
  const issueDate = date("issue_date", true);

  const currencyRaw = raw("currency").toUpperCase();
  const currency = currencyRaw || ctx.defaultCurrency;
  if (!/^[A-Z]{3}$/.test(currency))
    fail("currency", `"${raw("currency")}" isn't a 3-letter currency code like USD.`);

  let taxRate: string | null = null;
  const rateRaw = raw("tax_rate");
  if (rateRaw) {
    const bp = parsePercentBp(rateRaw);
    if (bp == null) fail("tax_rate", `"${rateRaw}" isn't a percentage like 8.25.`);
    else taxRate = formatBp(bp);
  }

  let category: string | null = null;
  const categoryRaw = raw("category");
  if (categoryRaw) {
    category = CATEGORY_BY.get(fold(categoryRaw)) ?? null;
    if (!category) fail("category", `Unknown category "${categoryRaw}".`);
  }
  let documentType = "invoice";
  const typeRaw = raw("document_type");
  if (typeRaw) {
    documentType = DOCTYPE_BY.get(fold(typeRaw)) ?? "";
    if (!documentType) fail("document_type", `Unknown document type "${typeRaw}".`);
  }

  let entityId: string | null = null;
  const codeRaw = raw("entity_code");
  const nameRaw = raw("entity");
  if (codeRaw || nameRaw) {
    const match =
      (codeRaw && ctx.entities.find((e) => e.code && fold(e.code) === fold(codeRaw))) ||
      (nameRaw && ctx.entities.find((e) => fold(e.name) === fold(nameRaw))) ||
      null;
    if (match) entityId = match.id;
    else fail(codeRaw ? "entity_code" : "entity", `No property or job matches "${codeRaw || nameRaw}".`);
  }

  const record = {
    supplier_name: supplier ?? "",
    supplier_tax_id: text("supplier_tax_id"),
    invoice_number: text("invoice_number"),
    document_type: documentType,
    issue_date: issueDate ?? "",
    due_date: date("due_date"),
    currency,
    subtotal_cents: money("subtotal_cents"),
    tax_cents: money("tax_cents"),
    tax_rate: taxRate,
    total_cents: totalCents ?? 0,
    category,
    entity_id: entityId,
  };
  if (errors.length) return { ok: false, errors };
  const parsed = ImportRecordSchema.safeParse(record);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ column: String(i.path[0] ?? ""), message: i.message })),
    };
  }
  return { ok: true, record: parsed.data };
}
