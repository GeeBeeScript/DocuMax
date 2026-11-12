import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PROTECTED = ["/app", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

const BASE = "http://documax.invalid";

/**
 * Only same-origin relative paths are honoured as post-login destinations (no open redirects). The value is
 * resolved the way a browser would (which strips tabs/newlines and treats `\` as `/`), and accepted only if it
 * stays on this origin; the normalised path is returned.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session cookie on every request and gates routes:
 * signed-out users are sent from /app and /onboarding to /login; signed-in users skip /login and /signup.
 * Authorization still happens in the database (RLS) — this is only navigation.
 */
export async function updateSession(request: NextRequest) {
  const env = clientEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Must run right after creating the client: it refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (!user && matches(pathname, PROTECTED)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return redirectTo(login);
  }
  if (user && matches(pathname, AUTH_PAGES)) {
    return redirectTo(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
  }
  return response;
}
