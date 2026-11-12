"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canReview, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateRecord, type ValidationIssue } from "@/lib/validation";
import { loadValidationContext, toValidationRecord } from "@/lib/validation/load";
import { BulkApproveSchema, ReviewRecordSchema } from "./schema";

/*
 * Review Server Actions. The record is changed only through the database's review_record() (role check, one
 * review_actions row per changed field, audit trigger). Issues are recomputed here with the same lib/validation code
 * the browser uses for live feedback — the server's result is the one stored.
 */

const FORBIDDEN = new ForbiddenError().message;

function dbError(error: { code?: string; message: string }) {
  if (error.code === "22023")
    return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "P0002" || error.code === "42501") return fail("Record not found.");
  return fail("Something went wrong. Please try again.");
}

export interface ReviewResult {
  status: "needs_review" | "approved" | "rejected";
  issues: ValidationIssue[];
}

export async function reviewRecord(input: unknown): Promise<ActionResult<ReviewResult>> {
  const parsed = ReviewRecordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);
  const { recordId, action, fields, lines, reason } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: current, error } = await supabase
    .from("records")
    .select(
      "*, line_items(position, quantity, unit_price_cents, amount_cents), document:documents(id, sha256)",
    )
    .eq("id", recordId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (error) return dbError(error);
  if (!current) return fail("Record not found.");

  // Re-validate the record as it will be after this change (corrected fields count as fully confident).
  const merged = { ...current, ...fields } as typeof current;
  merged.field_confidence = {
    ...(current.field_confidence as Record<string, number>),
    ...Object.fromEntries(Object.keys(fields ?? {}).map((k) => [k === "entity_id" ? "entity" : k, 1])),
  };
  const mergedLines = lines ?? current.line_items;
  const forValidation = toValidationRecord(
    merged,
    mergedLines.map((l) => ({ ...l, quantity: l.quantity == null ? null : Number(l.quantity) })),
  );
  const validation = await loadValidationContext(supabase, {
    orgId: ctx.org.id,
    record: forValidation,
    documentId: current.document?.id ?? null,
    sha256: current.document?.sha256 ?? null,
  });
  const issues = validateRecord(forValidation, validation);

  const { data, error: rpcError } = await supabase.rpc("review_record", {
    p_record: recordId,
    p_action: action,
    p_fields: (fields ?? null) as never,
    p_lines: (lines ?? null) as never,
    p_issues: issues as never,
    p_reason: reason ?? undefined,
  });
  if (rpcError) return dbError(rpcError);

  revalidatePath("/app/review");
  revalidatePath(`/app/review/${recordId}`);
  if (current.document_id) revalidatePath(`/app/documents/${current.document_id}`);
  return ok({ status: data.status, issues });
}

export async function bulkApproveClean(input: unknown): Promise<ActionResult<{ approved: number }>> {
  const parsed = BulkApproveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("bulk_approve_clean", { p_records: parsed.data.recordIds });
  if (error) return dbError(error);
  revalidatePath("/app/review");
  return ok({ approved: data });
}
