"use server";

import { redirect } from "next/navigation";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { clientEnv } from "@/lib/env";
import { safeNext } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authContent } from "@/content/auth";
import { LogInSchema, MagicLinkSchema, SignUpSchema } from "./schema";

function confirmUrl(next: string) {
  const url = new URL("/auth/confirm", clientEnv().NEXT_PUBLIC_APP_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function logIn(input: unknown): Promise<ActionResult> {
  const parsed = LogInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return fail(authContent.errors.invalidCredentials);
  redirect(safeNext(parsed.data.next));
}

/** Signs up; with email confirmation off the user is signed in and continues to onboarding (or `next`). */
export async function signUp(input: unknown): Promise<ActionResult<{ confirmEmail: true }>> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const next = safeNext(parsed.data.next, "/onboarding");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: confirmUrl(next) },
  });
  if (error) {
    return fail(error.code === "user_already_exists" ? authContent.errors.emailTaken : error.message);
  }
  if (!data.session) return ok({ confirmEmail: true as const });
  redirect(next);
}

export async function sendMagicLink(input: unknown): Promise<ActionResult> {
  const parsed = MagicLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: confirmUrl(safeNext(parsed.data.next)) },
  });
  // Don't reveal whether an account exists for the address.
  if (error && error.status !== 422 && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    return fail(authContent.errors.generic);
  }
  return ok();
}

export async function logOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
