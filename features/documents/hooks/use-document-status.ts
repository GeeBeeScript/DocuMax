"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/documents/status";

export interface LiveStatus {
  status: DocumentStatus;
  error: string | null;
}

const isStatus = (v: unknown): v is DocumentStatus => (DOCUMENT_STATUSES as readonly unknown[]).includes(v);

/**
 * Live document statuses for an org via Supabase Realtime (RLS applies to postgres_changes, so only this
 * org's rows arrive). `initial` comes from the server render; updates override it. `onChange` fires per update
 * (used for aria-live announcements and refreshing the page when a new row appears).
 */
export function useDocumentStatuses(
  orgId: string,
  initial: Record<string, LiveStatus>,
  onChange?: (documentId: string, next: LiveStatus) => void,
) {
  const [live, setLive] = useState<Record<string, LiveStatus>>({});
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    (async () => {
      // Authenticate the realtime socket with the user's session BEFORE joining: otherwise the channel joins
      // as anon and RLS filters out every row.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel = supabase
        .channel(`documents:${orgId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "documents", filter: `org_id=eq.${orgId}` },
          (payload) => {
            const row = payload.new as { id?: string; status?: unknown; error?: string | null };
            if (!row.id || !isStatus(row.status)) return;
            const next = { status: row.status, error: row.error ?? null };
            setLive((prev) => ({ ...prev, [row.id!]: next }));
            onChangeRef.current?.(row.id, next);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId]);

  return { ...initial, ...live };
}

/** Single-document convenience wrapper. */
export function useDocumentStatus(
  orgId: string,
  documentId: string,
  initial: LiveStatus,
  onChange?: (next: LiveStatus) => void,
) {
  const all = useDocumentStatuses(orgId, { [documentId]: initial }, (id, next) => {
    if (id === documentId) onChange?.(next);
  });
  return all[documentId] ?? initial;
}
