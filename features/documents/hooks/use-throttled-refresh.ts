"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * router.refresh(), at most once per `intervalMs`: the first call refreshes immediately, calls during the window
 * collapse into one trailing refresh. Keeps bulk uploads (many status changes) from hammering the server.
 */
export function useThrottledRefresh(intervalMs = 1500) {
  const router = useRouter();
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return useCallback(() => {
    const wait = last.current + intervalMs - Date.now();
    if (wait <= 0) {
      last.current = Date.now();
      router.refresh();
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        last.current = Date.now();
        router.refresh();
      }, wait);
    }
  }, [router, intervalMs]);
}
