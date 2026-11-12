"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canReview, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { AllocationError, allocateByAmount, allocateByPercent } from "@/lib/calc/allocate";
import { cents } from "@/lib/calc/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetAllocationsSchema } from "./schema";

/*
 * Allocation Server Actions. Inputs are checked with the same lib/calc functions that compute the split (so the
 * person gets the same message the editor shows); set_allocations() checks the role and validates again, writes
 * atomically, and the audit trigger records every row.
 */

function dbError(error: { code?: string; message: string }) {
  if (error.code === "22023")
    return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "P0002" || error.code === "42501") return fail("Record not found.");
  return fail("Something went wrong. Please try again.");
}

export async function setAllocations(input: unknown): Promise<ActionResult<{ rows: number }>> {
  const parsed = SetAllocationsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(new ForbiddenError().message);
  const { recordId, lineItemId, method, splits } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: record, error } = await supabase
    .from("records")
    .select("id, total_cents, entity_id, document_id, line_items(id, amount_cents)")
    .eq("org_id", ctx.org.id)
    .eq("id", recordId)
    .maybeSingle();
  if (error) return dbError(error);
  if (!record) return fail("Record not found.");

  const source = lineItemId
    ? record.line_items.find((l) => l.id === lineItemId)?.amount_cents
    : record.total_cents;
  if (splits.length > 0) {
    if (source == null) return fail("Set the amount before splitting it.");
    try {
      if (method === "percent")
        allocateByPercent(
          cents(source),
          splits.map((s) => ({ key: s.entityId, percentBp: s.percentBp! })),
        );
      else
        allocateByAmount(
          cents(source),
          splits.map((s) => ({ key: s.entityId, amountCents: cents(s.amountCents!) })),
          record.entity_id ?? "__home__",
        );
    } catch (e) {
      if (e instanceof AllocationError) return fail(e.message);
      throw e;
    }
  }

  const { data, error: rpcError } = await supabase.rpc("set_allocations", {
    p_record: recordId,
    p_line_item: lineItemId as string, // null = the whole record (generated types miss nullability)
    p_method: method,
    p_splits: splits.map((s) =>
      method === "percent"
        ? { entity_id: s.entityId, percent_bp: s.percentBp }
        : { entity_id: s.entityId, amount_cents: s.amountCents },
    ),
  });
  if (rpcError) return dbError(rpcError);

  revalidatePath(`/app/review/${recordId}`);
  revalidatePath("/app/entities", "layout");
  return ok({ rows: data });
}
