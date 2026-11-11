"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canManageEntities, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateEntitySchema, SetEntityStatusSchema, UpdateEntitySchema } from "./schema";

/* Entity Server Actions: parse → active org → role → write (RLS again) → revalidate → ActionResult. */

const PATH = "/app/entities";

function dbError(error: { code?: string }) {
  if (error.code === "23505") return fail("That reference is already used.", { code: ["Already used."] });
  if (error.code === "42501") return fail(new ForbiddenError().message);
  return fail("Something went wrong. Please try again.");
}

export async function createEntity(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateEntitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageEntities(ctx.role)) return fail(new ForbiddenError().message);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .insert({
      org_id: ctx.org.id,
      kind: ctx.org.entity_kind,
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      address: parsed.data.address ?? null,
      client_name: parsed.data.clientName ?? null,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  revalidatePath(PATH);
  return ok({ id: data.id });
}

export async function updateEntity(input: unknown): Promise<ActionResult> {
  const parsed = UpdateEntitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageEntities(ctx.role)) return fail(new ForbiddenError().message);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .update({
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      address: parsed.data.address ?? null,
      client_name: parsed.data.clientName ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("org_id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail("Not found.");
  revalidatePath(PATH);
  return ok();
}

/** Archive or restore. Archived entities keep their documents but disappear from pickers. */
export async function setEntityStatus(input: unknown): Promise<ActionResult> {
  const parsed = SetEntityStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageEntities(ctx.role)) return fail(new ForbiddenError().message);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("org_id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail("Not found.");
  revalidatePath(PATH);
  return ok();
}
