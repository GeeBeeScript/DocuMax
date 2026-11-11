"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/app/file-dropzone";
import { SelectField, type SelectOption } from "@/components/app/select-field";
import { UploadTray } from "@/components/app/upload-tray";
import { documentsCopy } from "@/content/app";
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from "@/lib/documents/upload-rules";
import { useUploadQueue } from "../hooks/use-upload-queue";

/** Dropzone + optional entity assignment + upload tray. New documents appear in the list via refresh. */
export function UploadPanel({
  entityOptions,
  entitySingular,
}: {
  entityOptions: SelectOption[];
  entitySingular: string;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState("");
  const { items, add, clearFinished } = useUploadQueue({ onUploaded: () => router.refresh() });
  const copy = documentsCopy;

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
        onFiles={(files) => add(files, entityId || undefined)}
        labels={{ ...copy.dropzone, hint: copy.dropzone.hint(UPLOAD_TYPES_LABEL) }}
      />
      <UploadTray items={items} onClear={clearFinished} labels={copy.tray} />
    </div>
  );
}
