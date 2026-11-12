import { z } from "zod";
import { periodError } from "@/lib/calc/period";

const Period = z
  .object({ start: z.iso.date(), end: z.iso.date() })
  .refine((p) => periodError(p) === null, { message: "Choose a valid period." });

export const StatementReportSchema = z.object({ entityId: z.uuid(), period: Period });
export const SummaryReportSchema = z.object({ period: Period });
export const BatchSchema = z.object({ period: Period });

export const QuoteReportSchema = z.object({
  entityId: z.uuid(),
  period: Period,
  /** Basis points (1 500 = 15%). */
  markupBp: z.number().int().min(0, "Markup can't be negative.").max(100_000, "Markup is at most 1000%."),
  taxRateBp: z.number().int().min(0, "Tax can't be negative.").max(10_000, "Tax is at most 100%."),
  validDays: z.number().int().min(1).max(365),
  notes: z.string().trim().max(1000).optional(),
});

export type QuoteReportInput = z.input<typeof QuoteReportSchema>;
