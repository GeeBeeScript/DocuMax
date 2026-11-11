import { cn } from "@/lib/utils";
import { confidenceBand } from "@/lib/documents/status";

const bandClass = {
  high: "bg-success-soft text-success",
  medium: "bg-yellow-soft text-ink",
  low: "bg-danger-soft text-danger",
} as const;

/** Shows an AI field confidence score (0–1) as a colored percentage pill. */
export function ConfidencePill({
  score,
  threshold,
  className,
}: {
  score: number;
  threshold?: number;
  className?: string;
}) {
  const band = confidenceBand(score, threshold);
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        bandClass[band],
        className,
      )}
      title={`${band} confidence`}
    >
      <span className="sr-only">Confidence </span>
      {pct}%
    </span>
  );
}
