// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { ExtractionError, extractInvoice, normalizeModelOutput } from "./extract";
import { InvoiceExtraction, ModelExtraction } from "./extraction-schema";
import { buildUserMessage, EXTRACTION_SYSTEM_PROMPT } from "./prompt";

const recorded = (name: string) => readFileSync(path.join(process.cwd(), "tests/fixtures/ai", name), "utf8");
const pages = [{ pageNo: 1, text: "Brightline Plumbing Co. Invoice INV-2041 Total due 1260.57" }];
const context = {
  entityKind: "property" as const,
  entities: [{ name: "12 Elm Street", code: "ELM-12", address: null }],
};

type Reply = { text: string; finish?: "stop" | "content-filter" };
/** A mock model that answers each call with the next reply; records the prompts it saw. */
function mockModel(replies: Reply[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const reply = replies[Math.min(call++, replies.length - 1)];
      return {
        content: [{ type: "text", text: reply.text }],
        finishReason: {
          unified: reply.finish ?? "stop",
          raw: reply.finish === "content-filter" ? "refusal" : "end_turn",
        },
        usage: {
          inputTokens: { total: 1200, noCache: 1200, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 300, text: 300, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}
const promptText = (model: MockLanguageModelV4, i: number) => JSON.stringify(model.doGenerateCalls[i].prompt);

describe("recorded outputs", () => {
  it("valid output passes both schemas", () => {
    const raw = JSON.parse(recorded("valid-digital-invoice.json"));
    expect(ModelExtraction.safeParse(raw).success).toBe(true);
    expect(InvoiceExtraction.safeParse(normalizeModelOutput(raw)).success).toBe(true);
  });

  it("partially null output is valid (absent fields are null, not invented)", () => {
    const parsed = InvoiceExtraction.parse(
      normalizeModelOutput(JSON.parse(recorded("partial-null-receipt.json"))),
    );
    expect(parsed.currency.value).toBeNull();
    expect(parsed.dueDate.value).toBeNull();
    expect(parsed.total.value).toBe("30.84");
  });

  it("invalid field values fail strict validation with readable paths", () => {
    const raw = JSON.parse(recorded("invalid-fields.json"));
    const result = InvoiceExtraction.safeParse(normalizeModelOutput(raw));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(
      expect.arrayContaining(["issueDate.value", "currency.value", "total.confidence"]),
    );
  });

  it("normalization trims and upper-cases the currency but never touches amounts", () => {
    const raw = JSON.parse(recorded("valid-digital-invoice.json"));
    raw.currency.value = " usd ";
    raw.total.value = " 1,260.57 ";
    raw.invoiceNumber.value = "   ";
    const out = normalizeModelOutput(raw) as typeof raw;
    expect(out.currency.value).toBe("USD");
    expect(out.total.value).toBe("1,260.57");
    expect(out.invoiceNumber.value).toBeNull();
  });
});

describe("extractInvoice", () => {
  it("returns the validated extraction with usage and attempt count", async () => {
    const model = mockModel([{ text: recorded("valid-digital-invoice.json") }]);
    const run = await extractInvoice(pages, context, { model });
    expect(run.attempts).toBe(1);
    expect(run.extraction.invoiceNumber.value).toBe("INV-2041");
    expect(run.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
    expect(run.schemaVersion).toBe(1);
    expect(model.doGenerateCalls[0].responseFormat).toMatchObject({ type: "json" });
  });

  it("sends the fixed system prompt and the page-marked document text", async () => {
    const model = mockModel([{ text: recorded("valid-digital-invoice.json") }]);
    await extractInvoice(pages, context, { model });
    const prompt = promptText(model, 0);
    expect(prompt).toContain("Never calculate");
    expect(prompt).toContain("--- page 1 ---");
    expect(prompt).toContain("12 Elm Street · code ELM-12");
  });

  it("does not send sampling parameters (current Claude models reject them)", async () => {
    const model = mockModel([{ text: recorded("valid-digital-invoice.json") }]);
    await extractInvoice(pages, context, { model });
    expect(model.doGenerateCalls[0].temperature).toBeUndefined();
  });

  it("retries malformed JSON, then succeeds", async () => {
    const model = mockModel([
      { text: recorded("malformed.txt") },
      { text: recorded("valid-digital-invoice.json") },
    ]);
    const run = await extractInvoice(pages, context, { model });
    expect(run.attempts).toBe(2);
    expect(promptText(model, 1)).toContain("not valid JSON");
    expect(run.usage.inputTokens).toBe(2400);
  });

  it("feeds validation errors back on retry", async () => {
    const model = mockModel([
      { text: recorded("invalid-fields.json") },
      { text: recorded("valid-digital-invoice.json") },
    ]);
    const run = await extractInvoice(pages, context, { model });
    expect(run.attempts).toBe(2);
    expect(promptText(model, 1)).toContain("issueDate.value");
  });

  it("gives up after 3 attempts with a permanent, readable error", async () => {
    const model = mockModel([{ text: recorded("invalid-fields.json") }]);
    const error = await extractInvoice(pages, context, { model }).catch((e) => e);
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error).toMatchObject({ code: "invalid_output" });
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it("treats a refusal as permanent (no retries)", async () => {
    const model = mockModel([{ text: "", finish: "content-filter" }]);
    await expect(extractInvoice(pages, context, { model })).rejects.toMatchObject({ code: "refused" });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("rethrows transport errors for the job to retry", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("socket hang up");
      },
    });
    await expect(extractInvoice(pages, context, { model })).rejects.toThrow("socket hang up");
  });
});

describe("prompt", () => {
  it("system prompt lists every category and forbids arithmetic", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/Never calculate/);
    expect(EXTRACTION_SYSTEM_PROMPT).toContain("- labor_subcontract:");
  });

  it("user message handles empty pages and no entities", () => {
    const msg = buildUserMessage([{ pageNo: 2, text: "  " }], { entityKind: "job", entities: [] });
    expect(msg).toContain("No jobs have been set up yet.");
    expect(msg).toContain("--- page 2 ---\n(no text found on this page)");
  });
});
