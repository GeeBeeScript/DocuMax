import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * DEV/TEST ONLY (`AI_PROVIDER=mock`): a deterministic stand-in for a real model so the pipeline runs end to end
 * without an API key (local dev, E2E). It reads the document text from the prompt and fills the schema with simple
 * pattern matching at confidence 0.6, so its results always route to human review. Refused in production
 * (lib/env.ts).
 */

const field = (value: string | null, confidence = 0.6) => ({
  value,
  confidence: value == null ? 0.5 : confidence,
});

/** The document text from the user message (after "Document text:"). */
function documentText(prompt: { role: string; content: unknown }[]): string {
  const user = prompt
    .filter((m) => m.role === "user" && Array.isArray(m.content))
    .flatMap((m) => m.content as { type: string; text?: string }[])
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join("\n");
  const start = user.indexOf("Document text:");
  return start === -1 ? user : user.slice(start + "Document text:".length);
}

export function heuristicExtraction(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--- page") && !l.startsWith("Document text:"));
  const find = (re: RegExp) => text.match(re)?.[1] ?? null;
  const amount = (label: string) =>
    find(new RegExp(`${label}[^\\d\\n]{0,24}([\\d,]+\\.\\d{2})`, "i"))?.replace(/,/g, "") ?? null;
  const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
  const billTo = find(/Bill to:[^\n]*?(?:—|-)\s*([^\n]+)$/m);
  return {
    documentType: field(/receipt/i.test(text) ? "receipt" : "invoice"),
    supplier: {
      name: field(lines[0] ?? null),
      taxId: field(find(/Tax ID\s*([\w-]+)/i)),
      address: field(null),
    },
    invoiceNumber: field(find(/(?:Invoice|Receipt)\s*(?:No\.?|#)?\s*([A-Z]*-?\d[\w-]*)/i)),
    issueDate: field(dates[0] ?? null),
    dueDate: field(find(/Due\s+(\d{4}-\d{2}-\d{2})/i)),
    currency: field(/\$|USD/.test(text) ? "USD" : null),
    subtotal: field(amount("\\bSubtotal\\b")),
    tax: {
      amount: field(amount("\\bTax\\b(?! ID)(?:\\s+[\\d.]+%)?")),
      rate: field(find(/\bTax\s+([\d.]+)%/i)),
    },
    total: field(amount("\\bTotal\\b(?: due)?")),
    category: field("other"),
    entityHint: field(billTo?.trim() ?? null),
    lineItems: [],
  };
}

export function createDevExtractionModel(): LanguageModel {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: "heuristic-dev-model",
    doGenerate: async ({ prompt }) => ({
      content: [{ type: "text", text: JSON.stringify(heuristicExtraction(documentText(prompt))) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}
