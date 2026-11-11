import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ViewToggleOption {
  value: string;
  label: string;
  href: string;
}

/**
 * Pill toggle made of links (state lives in the URL, so it works in Server Components and is shareable).
 * The current option is marked with aria-current.
 */
export function ViewToggle({
  label,
  options,
  value,
  className,
}: {
  label: string;
  options: readonly ViewToggleOption[];
  value: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("inline-flex rounded-full bg-gray-100 p-1", className)}>
      {options.map((o) => {
        const current = o.value === value;
        return (
          <Link
            key={o.value}
            href={o.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-4 text-sm font-semibold text-ink-soft transition-colors hover:text-ink",
              current && "bg-paper text-ink shadow-card",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
