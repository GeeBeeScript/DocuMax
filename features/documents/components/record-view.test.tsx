import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Money } from "@/components/app/money";
import type { DocumentRecord } from "../queries";
import { RecordView } from "./record-view";

const record = {
  id: "r1",
  org_id: "o1",
  document_id: "d1",
  extraction_id: "x1",
  entity_id: "e1",
  document_type: "invoice",
  supplier_name: "Brightline Plumbing Co.",
  supplier_tax_id: null,
  invoice_number: "INV-2041",
  issue_date: "2026-10-14",
  due_date: null,
  currency: "USD",
  subtotal_cents: 116450,
  tax_cents: 9607,
  tax_rate: 8.25,
  total_cents: 126057,
  category: "repairs_maintenance",
  entity_hint: "12 Elm Street",
  status: "needs_review",
  min_confidence: 0.62,
  field_confidence: { supplier_name: 0.97, total_cents: 0.62, entity: 0.93, invoice_number: 0.9 },
  approved_by: null,
  approved_at: null,
  created_at: "2026-11-12T10:00:00Z",
  updated_at: "2026-11-12T10:00:00Z",
} as unknown as DocumentRecord["record"];
const line = (position: number, amount: number) =>
  ({
    id: `l${position}`,
    position,
    description: `Line ${position}`,
    quantity: 1,
    unit_price_cents: null,
    amount_cents: amount,
    category: "materials",
    confidence: 0.95,
  }) as unknown as DocumentRecord["lineItems"][number];

describe("Money", () => {
  it("formats cents for the currency, dash for null", () => {
    const { rerender } = render(<Money value={126057} currency="USD" />);
    expect(screen.getByText("$1,260.57")).toBeInTheDocument();
    rerender(<Money value={-1250} currency="EUR" />);
    expect(screen.getByText("-€12.50")).toBeInTheDocument();
    rerender(<Money value={null} currency="USD" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("RecordView", () => {
  it("shows a pending state without a record", () => {
    render(<RecordView data={null} entitySingular="Property" threshold={0.85} />);
    expect(screen.getByRole("heading", { name: "No extracted data yet" })).toBeInTheDocument();
  });

  it("renders fields with confidence pills banded by the org threshold", () => {
    const { container } = render(
      <RecordView
        data={{ record, lineItems: [line(1, 42000), line(2, 56000)], entityName: "12 Elm Street" }}
        entitySingular="Property"
        threshold={0.85}
      />,
    );
    const fields = within(container.querySelector("dl")!);
    const field = (label: string) => fields.getByText(label, { exact: true }).closest("div")!;
    expect(within(field("Supplier")).getByText("Brightline Plumbing Co.")).toBeInTheDocument();
    expect(within(field("Supplier")).getByText("97%")).toHaveAttribute("title", "high confidence");
    expect(within(field("Total")).getByText("$1,260.57")).toBeInTheDocument();
    expect(within(field("Total")).getByText("62%")).toHaveAttribute("title", "medium confidence");
    expect(within(field("Tax (8.25%)")).getByText("$96.07")).toBeInTheDocument();
    expect(within(field("Issue date")).getByText("Oct 14, 2026")).toBeInTheDocument();
    expect(within(field("Due date")).getByText("—")).toBeInTheDocument();
    expect(within(field("Property")).getByText("12 Elm Street")).toBeInTheDocument();
    expect(within(field("Category")).getByText("Repairs & maintenance")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Line items" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Line 2" }).closest("tr")).toHaveTextContent("$560.00");
  });

  it("says when there are no line items", () => {
    render(
      <RecordView data={{ record, lineItems: [], entityName: null }} entitySingular="Job" threshold={0.85} />,
    );
    expect(screen.getByText("No line items were found on this document.")).toBeInTheDocument();
  });
});
