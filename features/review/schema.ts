import { z } from "zod";
import { CATEGORIES, DOCUMENT_TYPES } from "@/lib/ai/extraction-schema";

const text = (max: number) => z.string().trim().max(max).nullable();
const cents = z.number().int().min(-1e13).max(1e13).nullable();
const decimal = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Use a number like 3.5")
  .nullable();

/** Editable record fields (snake_case = `records` columns). Every key optional: send only what changed. */
export const ReviewFieldsSchema = z
  .object({
    document_type: z.enum(DOCUMENT_TYPES).nullable(),
    supplier_name: text(200),
    supplier_tax_id: text(60),
    invoice_number: text(80),
    issue_date: z.iso.date().nullable(),
    due_date: z.iso.date().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter code like USD")
      .nullable(),
    subtotal_cents: cents,
    tax_cents: cents,
    tax_rate: decimal,
    total_cents: cents,
    category: z.enum(CATEGORIES).nullable(),
    entity_id: z.uuid().nullable(),
  })
  .partial()
  .strict();

export const ReviewLineSchema = z.object({
  position: z.number().int().min(1).max(1000),
  description: text(500),
  quantity: decimal,
  unit_price_cents: cents,
  amount_cents: cents,
  category: z.enum(CATEGORIES).nullable(),
});

export const REVIEW_ACTIONS = ["correct", "approve", "reject", "reopen"] as const;

export const ReviewRecordSchema = z
  .object({
    recordId: z.uuid(),
    action: z.enum(REVIEW_ACTIONS),
    fields: ReviewFieldsSchema.optional(),
    lines: z.array(ReviewLineSchema).max(500).optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.action !== "reject" || !!v.reason, {
    message: "Give a reason for rejecting.",
    path: ["reason"],
  });

export const BulkApproveSchema = z.object({ recordIds: z.array(z.uuid()).min(1).max(200) });

export type ReviewFields = z.infer<typeof ReviewFieldsSchema>;
export type ReviewLine = z.infer<typeof ReviewLineSchema>;
export type ReviewRecordInput = z.infer<typeof ReviewRecordSchema>;
