import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { StickyNote } from "@/components/brand/sticky-note";
import { cn } from "@/lib/utils";

/** Board-canvas empty state: a sticky note with an icon, then title, description and an optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <BoardCanvas framed className={cn("flex flex-col items-center gap-4 px-6 py-14 text-center", className)}>
      <StickyNote color="yellow" tilt="left" className="flex size-16 items-center justify-center p-0">
        <Icon className="size-7 text-ink" aria-hidden />
      </StickyNote>
      <h2 className="mt-2 text-xl font-bold">{title}</h2>
      {description && <p className="max-w-md text-pretty text-muted-foreground">{description}</p>}
      {action}
    </BoardCanvas>
  );
}
