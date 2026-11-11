import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const stickyNoteVariants = cva("relative rounded-sm p-5 text-ink shadow-note", {
  variants: {
    color: {
      yellow: "bg-note-yellow",
      blue: "bg-note-blue",
      pink: "bg-note-pink",
      green: "bg-note-green",
      paper: "bg-paper",
    },
    tilt: {
      none: "",
      left: "-rotate-2",
      right: "rotate-2",
    },
  },
  defaultVariants: { color: "yellow", tilt: "none" },
});

export type StickyNoteProps = ComponentProps<"div"> & VariantProps<typeof stickyNoteVariants>;

/** Board-style sticky note card. Used in hero mockups, feature callouts and empty states. */
export function StickyNote({ className, color, tilt, ...props }: StickyNoteProps) {
  return <div className={cn(stickyNoteVariants({ color, tilt }), className)} {...props} />;
}
