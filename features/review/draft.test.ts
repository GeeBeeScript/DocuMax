import { describe, expect, it } from "vitest";
import { validateRecord } from "@/lib/validation";
import { buildContext } from "@/lib/validation/test-builders";
import type { Database } from "@/lib/supabase/database.types";
import {
  changedFields,
  emptyLine,
  fieldInputId,
  linesChanged,
  liveRecord,
  parseDraft,
  toDraft,
} from "./draft";

type RecordRow = Database["public"]["Tables"]["records"]["Row"];

const record = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "o",
  document_id: "d",
  extraction_id: null,
  document_type: "invoice",
  supplier_name: "ACME Plumbing LLC",
  supplier_tax_id: null,
  invoice_number: "INV-0042",
  issue_date: "2026-10-14",
  due_date: null,
  currency: "USD",
  subtotal_cents: 116450,
  tax_cents: 9607,
  tax_rate: 8.25,
  total_cents: 126099,
  category: "repairs_maintenance",
  entity_hint: null,
  entity_id: "22222222-2222-4222-8222-222222222222",
  min_confidence: 0.6,
  field_confidence: {
    supplier_name: 0.97,
    issue_date: 0.97,
    total_cents: 0.6,
    currency: 0.95,
    invoice_number: 0.97,
  },
  status: "needs_review",
  approved_by: null,
  approved_at: null,
  source: "ai",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
} as unknown as RecordRow;
const lines = [
  {
    position: 1,
    description: "Valve",
    quantity: 1,
    unit_price_cents: 42000,
    amount_cents: 42000,
    category: null,
  },
  {
    position: 2,
    description: "Labor",
    quantity: 3.5,
    unit_price_cents: 21200,
    amount_cents: 74200,
    category: null,
  },
] as never[];

describe("review draft", () => {
  it("round-trips the record unchanged: nothing to save", () => {
    const draft = toDraft(record, lines);
    expect(draft.fields).toMatchObject({
      total_cents: "1260.99",
      tax_rate: "8.25",
      issue_date: "2026-10-14",
    });
    const parsed = parseDraft(draft);
    expect(parsed.errors).toEqual({});
    expect(changedFields(record, parsed.fields)).toEqual({});
    expect(linesChanged(lines, parsed.lines)).toBe(false);
  });

  it("keeps only real changes, parsing amounts with separators and normalizing currency", () => {
    const draft = toDraft(record, lines);
    draft.fields.total_cents = "1,260.57";
    draft.fields.currency = " usd ";
    draft.fields.tax_rate = "8.250";
    draft.fields.supplier_tax_id = "  ";
    const parsed = parseDraft(draft);
    expect(changedFields(record, parsed.fields)).toEqual({ total_cents: 126057 });
  });

  it("reports unparseable input per field and line", () => {
    const draft = toDraft(record, lines);
    draft.fields.total_cents = "12.34.56";
    draft.fields.issue_date = "14/10/2026";
    draft.fields.currency = "dollars";
    draft.lines[1]!.quantity = "three";
    expect(Object.keys(parseDraft(draft).errors).sort()).toEqual([
      "currency",
      "issue_date",
      "lines[1].quantity",
      "total_cents",
    ]);
  });

  it("detects line edits, additions and removals", () => {
    const draft = toDraft(record, lines);
    draft.lines[0]!.amount_cents = "420.01";
    expect(linesChanged(lines, parseDraft(draft).lines)).toBe(true);
    const added = toDraft(record, lines);
    added.lines.push(emptyLine());
    expect(linesChanged(lines, parseDraft(added).lines)).toBe(true);
    const removed = toDraft(record, lines);
    removed.lines.pop();
    expect(linesChanged(lines, parseDraft(removed).lines)).toBe(true);
  });

  it("live validation: correcting the total clears the mismatch and its low confidence at once", () => {
    const ctx = buildContext();
    const draft = toDraft(record, lines);
    const before = parseDraft(draft);
    const codes = (p: ReturnType<typeof parseDraft>) =>
      validateRecord(liveRecord(record, p, changedFields(record, p.fields)), ctx).map((i) => i.code);
    expect(codes(before)).toEqual(expect.arrayContaining(["total_mismatch", "low_confidence"]));

    draft.fields.total_cents = "1260.57";
    expect(codes(parseDraft(draft))).not.toEqual(expect.arrayContaining(["total_mismatch"]));
    expect(codes(parseDraft(draft))).not.toContain("low_confidence");
  });

  it("maps issue fields to input ids", () => {
    expect(fieldInputId("total_cents")).toBe("review-total_cents");
    expect(fieldInputId("entity")).toBe("review-entity_id");
    expect(fieldInputId("lines[2].amount_cents")).toBe("review-lines-2-amount_cents");
  });
});
