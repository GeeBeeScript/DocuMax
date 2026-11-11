import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Runs as the signed-in user → all queries are subject to RLS.
 */
export async function createSupabaseServerClient() {
  const env = clientEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // Session refresh is handled by middleware (Phase 2).
        }
      },
    },
  });
}
