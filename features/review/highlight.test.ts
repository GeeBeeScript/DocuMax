import { describe, expect, it } from "vitest";
import { highlightPage } from "./highlight";

const pages = [
  { pageNo: 1, text: "ACME Plumbing\nInvoice INV-0042\nLabor 744.50" },
  { pageNo: 2, text: "Subtotal 1,164.50\nTax 96.07\nTOTAL DUE $1,260.57" },
];

describe("highlightPage", () => {
  it("finds the page where a flagged amount is printed (grouped or plain)", () => {
    expect(highlightPage(pages, { total_cents: 126057 }, "total_cents")).toBe(2);
    expect(highlightPage(pages, { tax_cents: 9607 }, "tax_cents")).toBe(2);
  });

  it("finds text fields case-insensitively", () => {
    expect(highlightPage(pages, { invoice_number: "inv-0042" }, "invoice_number")).toBe(1);
  });

  it("falls back to page 1 when there is nothing to look for or no match", () => {
    expect(highlightPage(pages, { total_cents: 1 }, "total_cents")).toBe(1);
    expect(highlightPage(pages, { total_cents: null }, "total_cents")).toBe(1);
    expect(highlightPage(pages, {}, null)).toBe(1);
    expect(highlightPage([], { total_cents: 126057 }, "total_cents")).toBe(1);
  });
});
