"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadItem } from "@/components/app/upload-tray";
import { documentsCopy } from "@/content/app";
import {
  checkUpload,
  formatBytes,
  resolveUploadType,
  uploadRejectionMessage,
} from "@/lib/documents/upload-rules";
import { confirmUpload, requestUpload } from "../actions";
import { putWithProgress, sha256Hex } from "../upload-client";

export const UPLOAD_CONCURRENCY = 3;

interface Job {
  key: string;
  file: File;
  mimeType: NonNullable<ReturnType<typeof resolveUploadType>>;
  entityId?: string;
}

/**
 * Client upload queue: validates files, then runs up to `concurrency` uploads at a time through
 * hash → requestUpload → PUT (with progress) → confirmUpload. Returns tray items + `add`.
 */
export function useUploadQueue({
  concurrency = UPLOAD_CONCURRENCY,
  onUploaded,
}: { concurrency?: number; onUploaded?: (documentId: string) => void } = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const pending = useRef<Job[]>([]);
  const active = useRef(0);
  const counter = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const run = useCallback(
    async ({ key, file, mimeType, entityId }: Job) => {
      try {
        update(key, { status: "hashing" });
        const sha256 = await sha256Hex(file);
        const ticket = await requestUpload({
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
          sha256,
          entityId,
        });
        if (!ticket.ok) return update(key, { status: "error", error: ticket.error });

        const { documentId, uploadUrl, duplicateOf } = ticket.data;
        update(key, {
          status: "uploading",
          progress: 0,
          warning: duplicateOf ? documentsCopy.tray.duplicate(duplicateOf.fileName) : undefined,
        });
        await putWithProgress(uploadUrl, file, mimeType, (progress) => update(key, { progress }));

        update(key, { status: "confirming", progress: 100 });
        const confirmed = await confirmUpload({ documentId });
        if (!confirmed.ok) return update(key, { status: "error", error: confirmed.error });
        update(key, { status: "done", href: `/app/documents/${documentId}` });
        onUploadedRef.current?.(documentId);
      } catch {
        update(key, { status: "error", error: "Upload failed. Check your connection and try again." });
      }
    },
    [update],
  );

  const pump = useCallback(() => {
    while (active.current < concurrency && pending.current.length > 0) {
      const job = pending.current.shift()!;
      active.current += 1;
      void run(job).finally(() => {
        active.current -= 1;
        pump();
      });
    }
  }, [concurrency, run]);

  const add = useCallback(
    (files: File[], entityId?: string) => {
      const next: UploadItem[] = [];
      for (const file of files) {
        const key = `u${(counter.current += 1)}`;
        const base = { key, name: file.name, size: formatBytes(file.size), progress: 0 };
        const rejection = checkUpload(file);
        const mimeType = resolveUploadType(file.name, file.type);
        if (rejection || !mimeType) {
          next.push({ ...base, status: "rejected", error: uploadRejectionMessage[rejection ?? "type"] });
          continue;
        }
        next.push({ ...base, status: "waiting" });
        pending.current.push({ key, file, mimeType, entityId });
      }
      setItems((prev) => [...next, ...prev]);
      pump();
    },
    [pump],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => !["done", "error", "rejected"].includes(i.status)));
  }, []);

  return { items, add, clearFinished };
}
