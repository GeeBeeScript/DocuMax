"use client";

import type { ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

/**
 * Crossfades between children when `swapKey` changes (tab panels, showcase visuals).
 * Keep durations ≤ 300ms per the design system.
 */
export function FadeSwap({
  swapKey,
  children,
  className,
}: {
  swapKey: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={swapKey}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
