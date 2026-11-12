"use client";

import { useState } from "react";
import { OverLimitDialog } from "@/features/billing/components/over-limit-dialog";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/app/file-dropzone";
import { SelectField, type SelectOption } from "@/components/app/select-field";
import { UploadTray } from "@/components/app/upload-tray";
import { documentsCopy } from "@/content/app";
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from "@/lib/documents/upload-rules";
import { useUploadQueue } from "../hooks/use-upload-queue";

export interface UploadQuota {
  /** Documents that still fit this month; null = unlimited. */
  remaining: number | null;
  cap: number | null;
  planName: string;
  canManageBilling: boolean;
}

/**
 * Dropzone + optional entity assignment + upload tray. New documents appear in the list via refresh. With a
 * monthly cap, dropping more files than still fit opens the over-limit dialog first (the server enforces the cap
 * anyway — a refusal mid-way opens it too).
 */
export function UploadPanel({
  entityOptions,
  entitySingular,
  quota,
}: {
  entityOptions: SelectOption[];
  entitySingular: string;
  quota?: UploadQuota;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState("");
  const [overLimit, setOverLimit] = useState<{ files: File[]; remaining: number } | null>(null);
  const { items, add, clearFinished } = useUploadQueue({
    onUploaded: () => router.refresh(),
    onQuotaExceeded: () => setOverLimit((o) => o ?? { files: [], remaining: 0 }),
  });
  const copy = documentsCopy;

  const onFiles = (files: File[]) => {
    const remaining = quota?.remaining;
    if (remaining != null && files.length > remaining) return setOverLimit({ files, remaining });
    add(files, entityId || undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      {entityOptions.length > 0 && (
        <SelectField
          id="upload-entity"
          label={copy.assignLabel(entitySingular)}
          className="max-w-sm"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          options={[{ value: "", label: copy.unassigned }, ...entityOptions]}
        />
      )}
      <FileDropzone
        accept={UPLOAD_ACCEPT}
        onFiles={onFiles}
        labels={{ ...copy.dropzone, hint: copy.dropzone.hint(UPLOAD_TYPES_LABEL) }}
      />
      <UploadTray items={items} onClear={clearFinished} labels={copy.tray} />
      {quota && quota.cap != null && (
        <OverLimitDialog
          open={overLimit !== null}
          onOpenChange={(open) => !open && setOverLimit(null)}
          planName={quota.planName}
          cap={quota.cap}
          remaining={overLimit?.remaining ?? 0}
          canManageBilling={quota.canManageBilling}
          onUploadSome={() => {
            if (overLimit) add(overLimit.files.slice(0, overLimit.remaining), entityId || undefined);
            setOverLimit(null);
          }}
        />
      )}
    </div>
  );
}
