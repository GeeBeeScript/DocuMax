import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const issueBannerVariants = cva("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", {
  variants: {
    severity: {
      error: "bg-danger-soft text-danger",
      warning: "bg-yellow-soft text-ink",
    },
  },
});

/**
 * One validation issue: severity icon, short title, the rule's message and optional actions (jump to the field,
 * open the duplicate…). Errors block a plain approve; warnings are advisory.
 */
export function IssueBanner({
  severity,
  title,
  message,
  actions,
  className,
}: {
  severity: "error" | "warning";
  title: string;
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const Icon = severity === "error" ? CircleAlert : TriangleAlert;
  return (
    <div className={cn(issueBannerVariants({ severity }), className)} data-severity={severity}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold">
          <span className="sr-only">{severity === "error" ? "Error: " : "Warning: "}</span>
          {title}
        </p>
        <div className="break-words text-ink-soft">{message}</div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
