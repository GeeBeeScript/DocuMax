"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { LiveRegion } from "@/components/app/live-region";
import { StatusBadge } from "@/components/app/status-badge";
import { PillButton } from "@/components/brand/pill-button";
import { documentsCopy } from "@/content/app";
import { DOCUMENT_STATUS_META, type DocumentStatus } from "@/lib/documents/status";
import { retryDocument } from "../actions";
import { useDocumentStatus } from "../hooks/use-document-status";

/** Live status badge, failure message and retry for one document. */
export function DocumentStatusPanel({
  orgId,
  documentId,
  fileName,
  initialStatus,
  initialError,
  canRetry,
}: {
  orgId: string;
  documentId: string;
  fileName: string;
  initialStatus: DocumentStatus;
  initialError: string | null;
  canRetry: boolean;
}) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();
  const { status, error } = useDocumentStatus(
    orgId,
    documentId,
    { status: initialStatus, error: initialError },
    (next) => {
      setAnnouncement(documentsCopy.live(fileName, DOCUMENT_STATUS_META[next.status].label));
      if (next.status === "ready" || next.status === "needs_review" || next.status === "failed")
        router.refresh();
    },
  );

  const retry = () =>
    startTransition(async () => {
      const result = await retryDocument({ documentId });
      if (result.ok) toast.success(documentsCopy.detail.retried);
      else toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <LiveRegion message={announcement} />
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        {status === "failed" && canRetry && (
          <PillButton type="button" size="sm" variant="outline" disabled={pending} onClick={retry}>
            <RotateCw aria-hidden /> {documentsCopy.detail.retry}
          </PillButton>
        )}
      </div>
      {status === "failed" && (
        <FormAlert tone="danger">
          <strong>{documentsCopy.detail.failed}:</strong> {error ?? "Unknown error"}
        </FormAlert>
      )}
    </div>
  );
}
