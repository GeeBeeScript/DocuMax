import { z } from "zod";

export const ALLOCATION_METHODS = ["percent", "amount"] as const;

const Split = z.object({
  entityId: z.uuid(),
  percentBp: z.number().int().min(0).max(10_000).optional(),
  amountCents: z.number().int().min(-1e13).max(1e13).optional(),
});

/** Replace a record's split (record-level). An empty list removes the split. */
export const SetAllocationsSchema = z
  .object({
    recordId: z.uuid(),
    lineItemId: z.uuid().nullable().default(null),
    method: z.enum(ALLOCATION_METHODS),
    splits: z.array(Split).max(50),
  })
  .refine(
    (v) => v.splits.every((s) => (v.method === "percent" ? s.percentBp != null : s.amountCents != null)),
    { message: "Every row needs a value.", path: ["splits"] },
  );
export type SetAllocationsInput = z.input<typeof SetAllocationsSchema>;
