"use client";

import { useEffect } from "react";
import { useThrottledRefresh } from "@/features/documents/hooks/use-throttled-refresh";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Refreshes the server-rendered reports page when a report or batch of this org changes (Supabase Realtime; RLS
 * applies). While anything is still generating it also refreshes every few seconds, in case an event is missed.
 */
export function ReportsLive({ orgId, active }: { orgId: string; active: boolean }) {
  const refresh = useThrottledRefresh(1000);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel = supabase
        .channel(`reports:${orgId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reports", filter: `org_id=eq.${orgId}` },
          refresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "report_batches", filter: `org_id=eq.${orgId}` },
          refresh,
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, refresh]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  return null;
}
