import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import {
  InvoiceExtraction,
  ModelExtraction,
  SCHEMA_VERSION,
  type InvoiceExtractionResult,
} from "./extraction-schema";
import { buildUserMessage, EXTRACTION_SYSTEM_PROMPT, type ExtractionContext, type PageInput } from "./prompt";

export const MAX_EXTRACTION_ATTEMPTS = 3; // first try + 2 retries (docs/DOCUMENT_PIPELINE.md)

/**
 * Permanent extraction failure (no BullMQ retry): the model's answer kept failing validation, or the model
 * declined. `message` is shown to the user on the document.
 */
export class ExtractionError extends Error {
  constructor(
    public readonly code: "invalid_output" | "refused",
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export interface ExtractionRun {
  extraction: InvoiceExtractionResult;
  /** The last raw model output (stored for debugging and re-mapping). */
  raw: unknown;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  schemaVersion: number;
}

export interface ExtractOptions {
  model: LanguageModel;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
  maxAttempts?: number;
}

/** Cosmetic clean-up before strict validation (trim strings, upper-case currency). Never changes amounts. */
export function normalizeModelOutput(output: z.infer<typeof ModelExtraction>): unknown {
  const trim = <T extends { value: string | null; confidence: number }>(f: T): T => ({
    ...f,
    value: typeof f.value === "string" ? f.value.trim() || null : f.value,
  });
  return {
    ...output,
    supplier: {
      name: trim(output.supplier.name),
      taxId: trim(output.supplier.taxId),
      address: trim(output.supplier.address),
    },
    invoiceNumber: trim(output.invoiceNumber),
    issueDate: trim(output.issueDate),
    dueDate: trim(output.dueDate),
    currency: { ...trim(output.currency), value: output.currency.value?.trim().toUpperCase() || null },
    subtotal: trim(output.subtotal),
    tax: { amount: trim(output.tax.amount), rate: trim(output.tax.rate) },
    total: trim(output.total),
    entityHint: trim(output.entityHint),
    lineItems: output.lineItems.map((l) => ({
      ...l,
      description: trim(l.description),
      quantity: trim(l.quantity),
      unitPrice: trim(l.unitPrice),
      amount: trim(l.amount),
    })),
  };
}

/** Short, model-readable list of validation problems for the retry message. */
function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((i) => `- ${i.path.join(".")}: ${i.message}`)
    .join("\n");
}

/**
 * Stage 2: page text → validated `InvoiceExtraction`. Retries (with the validation errors fed back) when the
 * output doesn't parse or fails strict validation; network/API errors are rethrown for the job to retry.
 */
export async function extractInvoice(
  pages: readonly PageInput[],
  context: ExtractionContext,
  { model, providerOptions, maxAttempts = MAX_EXTRACTION_ATTEMPTS }: ExtractOptions,
): Promise<ExtractionRun> {
  const userMessage = buildUserMessage(pages, context);
  const usage = { inputTokens: 0, outputTokens: 0 };
  const started = Date.now();
  let feedback = "";
  let raw: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await generateText({
        model,
        system: EXTRACTION_SYSTEM_PROMPT,
        prompt: feedback ? `${userMessage}\n\n${feedback}` : userMessage,
        output: Output.object({ schema: ModelExtraction }),
        maxOutputTokens: 16_000,
        providerOptions,
      });
      usage.inputTokens += result.usage.inputTokens ?? 0;
      usage.outputTokens += result.usage.outputTokens ?? 0;

      if (result.finishReason === "content-filter") {
        throw new ExtractionError("refused", "The AI service declined to process this document.");
      }
      raw = result.output;
      const parsed = InvoiceExtraction.safeParse(normalizeModelOutput(result.output));
      if (parsed.success) {
        return {
          extraction: parsed.data,
          raw,
          attempts: attempt,
          usage,
          latencyMs: Date.now() - started,
          schemaVersion: SCHEMA_VERSION,
        };
      }
      feedback = `Your previous answer did not pass validation:\n${describeIssues(parsed.error)}\nReturn the full corrected object.`;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
        if (NoObjectGeneratedError.isInstance(error)) {
          // The failed call was still billed — count it.
          usage.inputTokens += error.usage?.inputTokens ?? 0;
          usage.outputTokens += error.usage?.outputTokens ?? 0;
          raw = error.text ?? raw;
        }
        feedback = "Your previous answer was not valid JSON for the schema. Return only the object.";
        continue;
      }
      throw error; // ExtractionError (permanent) or a transient API/network error
    }
  }

  throw new ExtractionError(
    "invalid_output",
    "The AI couldn't produce a valid result for this document. Try again, or contact support if it keeps happening.",
    feedback,
  );
}
