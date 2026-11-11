import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ResourceLink } from "@/content/types";
import { cn } from "@/lib/utils";

/** "Need help getting started?" row of linked cards. */
export function ResourceLinks({
  title,
  items,
  className,
}: {
  title: string;
  items: readonly ResourceLink[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <h2 className="text-3xl font-bold">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((r) => (
          <li key={r.title}>
            <Link
              href={r.href}
              className="group flex h-full items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-paper p-5 transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none"
            >
              <span>
                <span className="block font-heading font-bold">{r.title}</span>
                <span className="block text-sm text-muted-foreground">{r.description}</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
