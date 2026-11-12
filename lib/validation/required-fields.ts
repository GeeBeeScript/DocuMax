/** Required record fields (missing_field / low_confidence). Invoice number only for invoices. */
export function requiredFields(documentType: string | null): string[] {
  const base = ["supplier_name", "issue_date", "total_cents", "currency"];
  return documentType === "invoice" ? [...base, "invoice_number"] : base;
}

export const FIELD_LABELS: Record<string, string> = {
  supplier_name: "Supplier",
  invoice_number: "Invoice number",
  issue_date: "Issue date",
  due_date: "Due date",
  currency: "Currency",
  subtotal_cents: "Subtotal",
  tax_cents: "Tax",
  total_cents: "Total",
  entity: "Property / job",
};
