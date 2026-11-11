import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gentle looping drift for decorative board elements (collab cursors, sticky notes).
 * Pure CSS (`animate-float` in globals.css) — no JS, no main-thread work, and disabled
 * automatically under prefers-reduced-motion. Decorative only.
 */
export function Float({
  children,
  className,
  x = 0,
  y = 8,
  duration = 6,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  x?: number;
  y?: number;
  duration?: number;
  delay?: number;
}) {
  const style = {
    "--float-x": `${x}px`,
    "--float-y": `${y}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
  } as CSSProperties;
  return (
    <div className={cn("motion-safe:animate-float", className)} style={style}>
      {children}
    </div>
  );
}
