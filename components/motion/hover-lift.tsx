"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Lifts its child slightly and deepens the shadow on hover/focus-within. Use on cards. */
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const base = cn("h-full rounded-[inherit] transition-shadow duration-200 hover:shadow-lift", className);
  if (reduce) return <div className={base}>{children}</div>;

  return (
    <m.div
      className={base}
      whileHover={{ y: -4 }}
      whileFocus={{ y: -4 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
