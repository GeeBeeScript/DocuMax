import { z } from "zod";

/** `reports.params` for quotes (validated when created and again when rendered). */
export const QuoteParamsSchema = z.object({
  number: z.string().min(1).max(40),
  markupBp: z.number().int().min(0).max(100_000),
  taxRateBp: z.number().int().min(0).max(10_000),
  issueDate: z.iso.date(),
  validUntil: z.iso.date(),
  notes: z.string().max(1000).nullable().default(null),
});
export type QuoteParams = z.infer<typeof QuoteParamsSchema>;
