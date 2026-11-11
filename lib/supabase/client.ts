import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Supabase client for Client Components (realtime status, direct uploads). RLS applies. */
export function createSupabaseBrowserClient() {
  const env = clientEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
