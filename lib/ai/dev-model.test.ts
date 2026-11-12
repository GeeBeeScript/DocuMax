// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
import { createDevExtractionModel } from "./dev-model";
import { extractInvoice } from "./extract";

const INVOICE = `Brightline Plumbing Co.
410 Canal Street, Springfield · Tax ID 47-2291034
Invoice INV-2041
Issue date 2026-10-14 · Due 2026-11-13 · Page 1 of 1
Bill to: Harbor & Pine Property Management — 12 Elm Street
Subtotal 1164.50
Tax 8.25% 96.07
Total due $1,260.57`;

afterEach(() => vi.unstubAllEnvs());

describe("dev model (AI_PROVIDER=mock)", () => {
  it("fills the schema from the document text and passes strict validation", async () => {
    const run = await extractInvoice(
      [{ pageNo: 1, text: INVOICE }],
      { entityKind: "property", entities: [] },
      { model: createDevExtractionModel() },
    );
    const e = run.extraction;
    expect(e.supplier.name.value).toBe("Brightline Plumbing Co.");
    expect(e.invoiceNumber.value).toBe("INV-2041");
    expect([e.issueDate.value, e.dueDate.value]).toEqual(["2026-10-14", "2026-11-13"]);
    expect([e.subtotal.value, e.tax.amount.value, e.tax.rate.value, e.total.value]).toEqual([
      "1164.50",
      "96.07",
      "8.25",
      "1260.57",
    ]);
    expect(e.entityHint.value).toBe("12 Elm Street");
    expect(e.currency.value).toBe("USD");
    // Never confident enough to skip review.
    expect(Math.max(e.total.confidence, e.supplier.name.confidence)).toBeLessThanOrEqual(0.6);
  });

  it("is refused in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.resetModules();
    const { extractionModel } = await import("./provider");
    expect(() => extractionModel()).toThrow(/development and tests only/);
  });
});
