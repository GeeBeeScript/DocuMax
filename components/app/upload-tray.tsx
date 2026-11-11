import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadItemStatus =
  "rejected" | "waiting" | "hashing" | "uploading" | "confirming" | "done" | "error";

export interface UploadItem {
  key: string;
  name: string;
  size: string;
  status: UploadItemStatus;
  /** 0–100 while uploading. */
  progress: number;
  error?: string;
  warning?: string;
  href?: string;
}

const icon: Partial<Record<UploadItemStatus, typeof Loader2>> = {
  done: CheckCircle2,
  error: CircleX,
  rejected: CircleX,
};

/** Per-file upload progress list. Presentational: the upload queue hook owns the state. */
export function UploadTray({
  items,
  labels,
  onClear,
  className,
}: {
  items: readonly UploadItem[];
  labels: {
    heading: string;
    clear: string;
    view: string;
    statuses: Record<UploadItemStatus, string>;
    progress: (name: string) => string;
  };
  onClear?: () => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  const busy = items.some((i) => !["done", "error", "rejected"].includes(i.status));

  return (
    <section
      aria-labelledby="upload-tray-heading"
      className={cn("rounded-2xl border border-gray-200 bg-paper", className)}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 id="upload-tray-heading" className="font-heading font-bold">
          {labels.heading} <span className="text-muted-foreground tabular-nums">({items.length})</span>
        </h2>
        {onClear && !busy && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-semibold text-ink underline underline-offset-4"
          >
            {labels.clear}
          </button>
        )}
      </div>
      <ul className="max-h-96 divide-y divide-gray-200 overflow-y-auto">
        {items.map((item) => {
          const Icon = icon[item.status] ?? Loader2;
          const failed = item.status === "error" || item.status === "rejected";
          return (
            <li key={item.key} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    item.status === "done" && "text-success",
                    failed && "text-danger",
                    !failed && item.status !== "done" && "animate-spin text-ink-soft",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.size}</span>
                <span
                  className={cn(
                    "w-20 shrink-0 text-right text-xs font-semibold",
                    failed ? "text-danger" : "text-ink-soft",
                  )}
                >
                  {labels.statuses[item.status]}
                </span>
                {item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs font-semibold underline underline-offset-4"
                  >
                    {labels.view}
                  </Link>
                )}
              </div>
              {item.status === "uploading" && (
                <div
                  role="progressbar"
                  aria-label={labels.progress(item.name)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress)}
                  className="h-1.5 overflow-hidden rounded-full bg-gray-100"
                >
                  <div
                    className="h-full rounded-full bg-ink transition-[width]"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && <p className="text-xs text-danger">{item.error}</p>}
              {item.warning && (
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />
                  {item.warning}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
