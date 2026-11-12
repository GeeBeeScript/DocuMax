/**
 * What a CSV row can fill in (one row = one record). `synonyms` drive the automatic column mapping; the export's
 * headers (lib/export/columns.ts) are always recognised, so an exported file maps itself.
 */
export const IMPORT_FIELDS = [
  {
    key: "supplier_name",
    label: "Supplier",
    required: true,
    synonyms: ["supplier", "vendor", "payee", "merchant", "supplier name", "vendor name"],
  },
  {
    key: "invoice_number",
    label: "Invoice number",
    required: false,
    synonyms: [
      "invoice number",
      "invoice no",
      "invoice #",
      "invoice",
      "number",
      "reference",
      "ref",
      "bill number",
      "receipt number",
    ],
  },
  {
    key: "issue_date",
    label: "Issue date",
    required: true,
    synonyms: ["issue date", "date", "invoice date", "bill date", "transaction date", "receipt date"],
  },
  { key: "due_date", label: "Due date", required: false, synonyms: ["due date", "due", "payment due"] },
  {
    key: "total_cents",
    label: "Total",
    required: true,
    synonyms: ["total", "amount", "total amount", "gross", "amount due", "grand total"],
  },
  {
    key: "subtotal_cents",
    label: "Subtotal",
    required: false,
    synonyms: ["subtotal", "sub total", "net", "net amount", "before tax", "amount before tax"],
  },
  {
    key: "tax_cents",
    label: "Tax",
    required: false,
    synonyms: ["tax", "tax amount", "vat", "gst", "sales tax"],
  },
  {
    key: "tax_rate",
    label: "Tax rate (%)",
    required: false,
    synonyms: ["tax rate", "tax rate (%)", "vat rate", "tax %", "rate"],
  },
  { key: "currency", label: "Currency", required: false, synonyms: ["currency", "currency code", "ccy"] },
  {
    key: "category",
    label: "Category",
    required: false,
    synonyms: ["category", "cost category", "expense category", "account"],
  },
  {
    key: "document_type",
    label: "Document type",
    required: false,
    synonyms: ["document type", "type", "doc type"],
  },
  {
    key: "supplier_tax_id",
    label: "Supplier tax ID",
    required: false,
    synonyms: ["supplier tax id", "tax id", "vat number", "ein", "abn"],
  },
  {
    key: "entity",
    label: "Property or job",
    required: false,
    synonyms: ["property", "job", "property or job", "unit", "building", "project", "site"],
  },
  {
    key: "entity_code",
    label: "Property / job reference",
    required: false,
    synonyms: [
      "reference",
      "reference code",
      "property ref",
      "property reference",
      "job number",
      "job no",
      "unit code",
      "code",
    ],
  },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Field → the CSV header it is read from (null = not in the file). */
export type ImportMapping = Partial<Record<ImportField, string | null>>;

export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
