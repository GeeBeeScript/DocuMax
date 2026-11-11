import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BoardCanvasProps = ComponentProps<"div"> & {
  /** Rounded framed board (product mockups) vs full-bleed section background. */
  framed?: boolean;
};

/** Dotted infinite-canvas surface — the signature Miro-style backdrop. */
export function BoardCanvas({ framed = false, className, ...props }: BoardCanvasProps) {
  return (
    <div
      className={cn(
        "relative bg-board",
        framed && "overflow-hidden rounded-3xl border border-gray-200",
        className,
      )}
      {...props}
    />
  );
}
