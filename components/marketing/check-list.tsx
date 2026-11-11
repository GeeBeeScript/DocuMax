import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bulleted list with yellow check discs — used by showcase and feature copy blocks. */
export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-ink-soft">
          <span
            aria-hidden
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow"
          >
            <Check className="size-3 text-ink" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
