import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * This month's documents against the plan's cap (sidebar, billing page). Turns yellow from 80% and red at the cap;
 * an unlimited plan shows the count only. Labels arrive from content.
 */
export function UsageMeter({
  used,
  cap,
  label,
  caption,
  href,
  className,
}: {
  used: number;
  /** null = unlimited */
  cap: number | null;
  /** Accessible description, e.g. "12 of 25 documents used this month". */
  label: string;
  /** Visible text under the bar, e.g. "12 of 25". */
  caption: string;
  href?: string;
  className?: string;
}) {
  const ratio = cap ? Math.min(used / cap, 1) : 0;
  const tone =
    cap == null ? "bg-ink" : ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-yellow-hover" : "bg-ink";
  const body = (
    <>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap ?? used}
        aria-valuenow={used}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${cap == null ? 100 : ratio * 100}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs text-muted-foreground",
          cap != null && ratio >= 1 && "font-semibold text-danger",
        )}
      >
        {caption}
      </p>
    </>
  );
  return href ? (
    <Link href={href} className={cn("flex flex-col gap-1.5 rounded-lg p-2 hover:bg-gray-50", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn("flex flex-col gap-1.5", className)}>{body}</div>
  );
}
