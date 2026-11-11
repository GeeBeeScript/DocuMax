import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-card", {
  variants: {
    color: {
      ink: "bg-ink text-paper",
      yellow: "bg-yellow text-ink",
      pink: "bg-note-pink text-ink",
      blue: "bg-note-blue text-ink",
    },
  },
  defaultVariants: { color: "ink" },
});

const fills = {
  ink: "fill-ink",
  yellow: "fill-yellow",
  pink: "fill-note-pink",
  blue: "fill-note-blue",
} as const;

export type CollabCursorProps = ComponentProps<"div"> &
  VariantProps<typeof labelVariants> & {
    label: string;
  };

/** Multiplayer-style cursor with a name tag — decorative, for board mockups. */
export function CollabCursor({ label, color, className, ...props }: CollabCursorProps) {
  return (
    <div aria-hidden className={cn("pointer-events-none flex flex-col items-start", className)} {...props}>
      <svg viewBox="0 0 16 16" className={cn("size-4 stroke-paper", fills[color ?? "ink"])} strokeWidth="1">
        <path d="M1 1l5.5 13 2-5.5L14 6.5z" />
      </svg>
      <span className={cn(labelVariants({ color }), "ml-3")}>{label}</span>
    </div>
  );
}
