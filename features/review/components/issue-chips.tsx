import { reviewCopy } from "@/content/app";
import { cn } from "@/lib/utils";
import type { QueueIssue } from "../queries";

/** Compact issue labels for a queue row (errors red, warnings yellow). */
export function IssueChips({ issues }: { issues: readonly QueueIssue[] }) {
  if (issues.length === 0)
    return (
      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
        {reviewCopy.queue.clean}
      </span>
    );
  const unique = [...new Map(issues.map((i) => [i.code, i])).values()];
  return (
    <ul className="flex flex-wrap gap-1">
      {unique.map((i) => (
        <li
          key={i.code}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
            i.severity === "error" ? "bg-danger-soft text-danger" : "bg-yellow-soft text-ink",
          )}
        >
          {reviewCopy.issues[i.code]}
        </li>
      ))}
    </ul>
  );
}
