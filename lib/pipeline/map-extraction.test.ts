import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { InvoiceExtraction, type InvoiceExtractionResult } from "@/lib/ai/extraction-schema";
import { normalizeModelOutput } from "@/lib/ai/extract";
import {
  combine,
  mapExtraction,
  matchEntity,
  normalizeText,
  ocrFactor,
  parseDecimal,
  similarity,
} from "./map-extraction";

const fixture = (name: string): InvoiceExtractionResult =>
  InvoiceExtraction.parse(
    normalizeModelOutput(
      JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures/ai", name), "utf8")),
    ),
  );
const textPage = [{ source: "text_layer" as const, ocrConfidence: null }];
const entities = [
  { id: "e-elm", name: "12 Elm Street", code: "ELM-12", address: "12 Elm St, Springfield" },
  { id: "e-oak", name: "Oak Plaza", code: "OAK-3", address: "300 Oak Avenue" },
  { id: "e-kitchen", name: "Kitchen remodel — Chen", code: "J-1042", address: "88 Harbor Road, Bayview" },
];

describe("confidence", () => {
  it("text-layer documents keep the model's confidence; OCR caps it at the weakest OCR page", () => {
    expect(ocrFactor(textPage)).toBe(1);
    expect(
      ocrFactor([
        { source: "text_layer", ocrConfidence: null },
        { source: "ocr", ocrConfidence: 0.91 },
        { source: "ocr", ocrConfidence: 0.74 },
      ]),
    ).toBe(0.74);
    expect(combine(0.97, 1)).toBe(0.97);
    expect(combine(0.97, 0.74)).toBe(0.74);
    expect(combine(0.6, 0.74)).toBe(0.6);
  });
});

describe("mapExtraction — digital invoice", () => {
  const { record, lineItems, entityMatch } = mapExtraction(fixture("valid-digital-invoice.json"), {
    pages: textPage,
    entities,
  });

  it("parses amounts to integer cents (never floats)", () => {
    expect(record).toMatchObject({
      subtotal_cents: 116450,
      tax_cents: 9607,
      total_cents: 126057,
      tax_rate: "8.25",
    });
    expect(lineItems.map((l) => l.amount_cents)).toEqual([42000, 56000, 18450]);
    expect(lineItems.map((l) => l.quantity)).toEqual(["1", "3.5", "4"]);
  });

  it("copies identity fields and matches the entity hint by address", () => {
    expect(record).toMatchObject({
      document_type: "invoice",
      supplier_name: "Brightline Plumbing Co.",
      invoice_number: "INV-2041",
      issue_date: "2026-10-14",
      currency: "USD",
      entity_id: "e-elm",
    });
    expect(entityMatch?.entityId).toBe("e-elm");
  });

  it("min_confidence is the lowest required field (currency 0.9 here)", () => {
    expect(record.min_confidence).toBe(0.9);
    expect(record.field_confidence.total_cents).toBe(0.99);
  });
});

describe("mapExtraction — edge cases", () => {
  it("OCR'd receipts: confidence capped, null currency drives min_confidence", () => {
    const { record } = mapExtraction(fixture("partial-null-receipt.json"), {
      pages: [{ source: "ocr", ocrConfidence: 0.88 }],
      entities,
    });
    expect(record.total_cents).toBe(3084);
    expect(record.field_confidence.total_cents).toBe(0.88);
    expect(record.currency).toBeNull();
    expect(record.min_confidence).toBe(0.4); // currency is required and null with 0.4
    expect(record.entity_id).toBeNull();
  });

  it("an unparseable printed amount becomes null with confidence 0", () => {
    const extraction = fixture("valid-digital-invoice.json");
    extraction.total = { value: "twelve dollars", confidence: 0.99 };
    const { record } = mapExtraction(extraction, { pages: textPage, entities });
    expect(record.total_cents).toBeNull();
    expect(record.field_confidence.total_cents).toBe(0);
    expect(record.min_confidence).toBe(0);
  });

  it("a user's entity assignment at upload wins over the AI hint", () => {
    const { record, entityMatch } = mapExtraction(fixture("valid-digital-invoice.json"), {
      pages: textPage,
      entities,
      assignedEntityId: "e-oak",
    });
    expect(record.entity_id).toBe("e-oak");
    expect(record.field_confidence.entity).toBe(1);
    expect(entityMatch).toBeNull();
  });

  it("invoice number is required only for invoices", () => {
    const receipt = fixture("partial-null-receipt.json");
    receipt.invoiceNumber = { value: null, confidence: 0.1 };
    expect(mapExtraction(receipt, { pages: textPage, entities }).record.min_confidence).toBe(0.4);
    const invoice = fixture("valid-digital-invoice.json");
    invoice.invoiceNumber = { value: null, confidence: 0.1 };
    expect(mapExtraction(invoice, { pages: textPage, entities }).record.min_confidence).toBe(0.1);
  });
});

describe("parseDecimal", () => {
  it.each([
    ["3.5", "3.5"],
    ["8.25%", "8.25"],
    ["2,5", "2.5"],
    ["-1", "-1"],
    ["two", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});

describe("entity matching", () => {
  it("normalizes text (case, accents, punctuation, street abbreviations)", () => {
    expect(normalizeText("12 Elm St.")).toBe("12 elm street");
    expect(normalizeText("Café Rd")).toBe("cafe road");
  });

  it.each([
    ["ELM-12", "e-elm", "code"],
    ["Job J1042 – kitchen", "e-kitchen", "code"],
    ["12 Elm Street", "e-elm", "name"],
    ["12 ELM ST", "e-elm", "name"],
    ["88 Harbor Rd Bayview", "e-kitchen", "address"],
    ["300 Oak Ave.", "e-oak", "address"],
  ])("%s → %s (by %s)", (hint, id, by) => {
    expect(matchEntity(hint, entities)).toMatchObject({ entityId: id, by });
  });

  it("tolerates small OCR slips", () => {
    expect(matchEntity("12 Eim Street", entities)?.entityId).toBe("e-elm");
  });

  it.each([[null], [""], ["Warehouse 9, Industrial Park"]])("no match for %j", (hint) => {
    expect(matchEntity(hint, entities)).toBeNull();
  });

  it("refuses ambiguous matches", () => {
    const twins = [
      { id: "a", name: "Unit 4 Elm Court", code: null, address: null },
      { id: "b", name: "Unit 4 Elm Court", code: null, address: null },
    ];
    expect(matchEntity("Unit 4 Elm Court", twins)).toBeNull();
  });

  it("similarity is symmetric and 1 for equal text", () => {
    expect(similarity("Oak Plaza", "oak plaza")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
    expect(similarity("Elm Street", "Street Elm")).toBe(similarity("Street Elm", "Elm Street"));
  });
});
