import { FileText, FolderUp } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import type { DocumentStatus } from "@/lib/documents/status";
import { cn } from "@/lib/utils";
import { MockWindow } from "./mock-window";

/** Bulk upload dropzone + live processing statuses. */
export function UploadMock({
  files,
  className,
}: {
  files: readonly { name: string; status: DocumentStatus }[];
  className?: string;
}) {
  return (
    <MockWindow title="Upload documents" className={cn("w-80", className)}>
      <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-4 text-xs text-gray-500">
        <FolderUp className="size-5 text-ink" />
        <span>Drop PDFs and photos here</span>
      </div>
      <ul className="mt-3 space-y-2">
        {files.map((f) => (
          <li key={f.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-ink">
              <FileText className="size-3.5 shrink-0 text-gray-500" />
              <span className="truncate">{f.name}</span>
            </span>
            <StatusBadge status={f.status} />
          </li>
        ))}
      </ul>
    </MockWindow>
  );
}
