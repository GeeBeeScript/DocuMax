import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dashboard card (Miro "recent boards" grid tile): icon, title, description, optional action. */
export function QuickStartCard({
  icon: Icon,
  title,
  description,
  action,
  muted = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-5 shadow-card",
        muted && "bg-gray-50 shadow-none",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          muted ? "bg-gray-100 text-gray-500" : "bg-yellow text-ink",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      {action && <div className="mt-auto pt-2">{action}</div>}
    </article>
  );
}
