"use client";

import { useEffect } from "react";
import { useThrottledRefresh } from "@/features/documents/hooks/use-throttled-refresh";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Re-renders a server page when rows of the given tables change for this org (Supabase Realtime; RLS applies).
 * While `active` (something still in progress) it also refreshes every few seconds, in case an event is missed.
 */
export function RealtimeRefresh({
  orgId,
  tables,
  active,
}: {
  orgId: string;
  tables: readonly string[];
  active: boolean;
}) {
  const refresh = useThrottledRefresh(1000);
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      // Authenticate the socket first, or RLS hides every event.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel = supabase.channel(`refresh:${key}:${orgId}`);
      for (const table of key.split(",")) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` },
          refresh,
        );
      }
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, key, refresh]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  return null;
}
