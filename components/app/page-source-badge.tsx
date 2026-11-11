import { cva } from "class-variance-authority";
import { confidenceBand } from "@/lib/documents/status";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      text: "bg-gray-100 text-gray-700",
      high: "bg-success-soft text-success",
      medium: "bg-yellow-soft text-ink",
      low: "bg-danger-soft text-danger",
    },
  },
});

/** Where a page's text came from: the PDF's text layer, or OCR with its confidence (colored by band). */
export function PageSourceBadge({
  source,
  confidence,
  labels,
  className,
}: {
  source: "text_layer" | "ocr";
  confidence: number | null;
  labels: { textLayer: string; ocr: string };
  className?: string;
}) {
  if (source === "text_layer") {
    return <span className={cn(badgeVariants({ tone: "text" }), className)}>{labels.textLayer}</span>;
  }
  const score = confidence ?? 0;
  return (
    <span
      className={cn(badgeVariants({ tone: confidenceBand(score) }), className)}
      title={`${labels.ocr} confidence`}
    >
      {labels.ocr} · <span className="tabular-nums">{Math.round(score * 100)}%</span>
    </span>
  );
}
