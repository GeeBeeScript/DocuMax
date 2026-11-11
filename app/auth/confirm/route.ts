import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing route for auth emails (magic link, sign-up confirmation). Supports the PKCE `code` flow and the
 * `token_hash` + `type` flow, then continues to `next` (same-origin paths only).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const supabase = await createSupabaseServerClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing token") };

  const url = new URL(error ? "/login" : next, request.url);
  if (error) url.searchParams.set("error", "link");
  return NextResponse.redirect(url);
}
