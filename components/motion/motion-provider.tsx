"use client";

import type { ReactNode } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

/**
 * App-wide Motion setup. LazyMotion + `m` components ship only the `domAnimation` feature set
 * (animations, variants, exit, hover/tap/focus, in-view) instead of the full bundle.
 * `strict` makes any accidental `motion.*` usage throw — always use `m.*` inside components/motion.
 * `reducedMotion="user"` honours the OS setting for every animation.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
