"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";

export type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds before the animation starts — use for manual staggering. */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
};

/**
 * Fade + rise into view once, when scrolled into the viewport.
 * Reduced-motion users get the content immediately with no transform.
 * All scroll-reveal in the app goes through this component.
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
