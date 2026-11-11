import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { DOCUMENT_STATUS_META, type DocumentStatus, type StatusTone } from "@/lib/documents/status";

export const statusToneVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-gray-100 text-gray-700",
        progress: "bg-note-blue text-ink",
        attention: "bg-yellow-soft text-ink ring-1 ring-yellow ring-inset",
        success: "bg-success-soft text-success",
        danger: "bg-danger-soft text-danger",
      } satisfies Record<StatusTone, string>,
    },
  },
);

const dotClass: Record<StatusTone, string> = {
  neutral: "bg-gray-400",
  progress: "bg-ink animate-pulse",
  attention: "bg-yellow-hover",
  success: "bg-success",
  danger: "bg-danger",
};

/** Document processing status chip. */
export function StatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const { label, tone } = DOCUMENT_STATUS_META[status];
  return (
    <span className={cn(statusToneVariants({ tone }), className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dotClass[tone])} />
      {label}
    </span>
  );
}
