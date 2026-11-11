"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/documents/status";

export interface LiveStatus {
  status: DocumentStatus;
  error: string | null;
  /** Row `updated_at` — decides which of two snapshots is newer. */
  updatedAt: string;
}

const isStatus = (v: unknown): v is DocumentStatus => (DOCUMENT_STATUSES as readonly unknown[]).includes(v);

/** The newer of two snapshots of the same document (ties keep `a`). */
export function newer(a: LiveStatus | undefined, b: LiveStatus | undefined): LiveStatus | undefined {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a;
}

/** Merge per-document snapshots, keeping the newest for each id. */
export function mergeStatuses(...sources: Record<string, LiveStatus>[]): Record<string, LiveStatus> {
  const merged: Record<string, LiveStatus> = {};
  for (const source of sources) {
    for (const [id, snapshot] of Object.entries(source)) merged[id] = newer(merged[id], snapshot)!;
  }
  return merged;
}

/**
 * Live document statuses for an org via Supabase Realtime (RLS applies to postgres_changes, so only this
 * org's rows arrive). Sources — the server render (`initial`), realtime events, and a re-fetch once the
 * subscription is live (covering changes made while it was connecting) — are merged by `updated_at`, so an
 * older snapshot can never overwrite a newer one. `onChange` fires per realtime update.
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
  const idsRef = useRef<string[]>([]);
  idsRef.current = Object.keys(initial);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    const apply = (updates: Record<string, LiveStatus>) => setLive((prev) => mergeStatuses(prev, updates));

    const resync = async () => {
      const ids = idsRef.current;
      if (ids.length === 0) return;
      const { data } = await supabase.from("documents").select("id, status, error, updated_at").in("id", ids);
      if (cancelled || !data) return;
      apply(
        Object.fromEntries(
          data.map((d) => [d.id, { status: d.status, error: d.error, updatedAt: d.updated_at }]),
        ),
      );
    };

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
            const row = payload.new as {
              id?: string;
              status?: unknown;
              error?: string | null;
              updated_at?: string;
            };
            if (!row.id || !isStatus(row.status) || !row.updated_at) return;
            const next = { status: row.status, error: row.error ?? null, updatedAt: row.updated_at };
            apply({ [row.id]: next });
            onChangeRef.current?.(row.id, next);
          },
        )
        .subscribe((state) => {
          if (state === "SUBSCRIBED") void resync();
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId]);

  return mergeStatuses(initial, live);
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
