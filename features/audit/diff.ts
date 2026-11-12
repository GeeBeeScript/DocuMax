/** Turns an audit_log row into the changes worth showing (pure). */

export interface AuditChange {
  key: string;
  before: unknown;
  after: unknown;
}

type Row = Record<string, unknown> | null;

/** Bookkeeping columns that change constantly or mean nothing to a person. */
const NOISE = new Set([
  "id",
  "org_id",
  "created_at",
  "updated_at",
  "field_confidence",
  "extraction_id",
  "storage_path",
]);
/** For created/deleted rows: the columns that identify the row, in this order. */
const SUMMARY_KEYS = [
  "name",
  "file_name",
  "supplier_name",
  "invoice_number",
  "description",
  "email",
  "role",
  "total_cents",
  "amount_cents",
  "status",
];

const asRow = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function auditChanges(entry: {
  action: "insert" | "update" | "delete";
  diff: unknown;
  before: unknown;
  after: unknown;
}): AuditChange[] {
  const before = asRow(entry.before);
  const after = asRow(entry.after);
  if (entry.action === "update") {
    const diff = asRow(entry.diff) ?? {};
    return Object.keys(diff)
      .filter((k) => !NOISE.has(k))
      .sort()
      .map((key) => ({ key, before: before?.[key] ?? null, after: diff[key] ?? null }));
  }
  const row = entry.action === "insert" ? after : before;
  if (!row) return [];
  return SUMMARY_KEYS.filter((k) => row[k] != null && row[k] !== "").map((key) =>
    entry.action === "insert"
      ? { key, before: null, after: row[key] }
      : { key, before: row[key], after: null },
  );
}

/** Currency for formatting amounts in this entry (records carry it; line items don't). */
export function auditCurrency(entry: { before: unknown; after: unknown }): string | null {
  const c = asRow(entry.after)?.currency ?? asRow(entry.before)?.currency;
  return typeof c === "string" ? c : null;
}
