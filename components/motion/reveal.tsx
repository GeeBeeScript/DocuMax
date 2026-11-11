"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";

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
 * All scroll-reveal in the app goes through this component.
 *
 * Reduced motion: the server can't know the user's preference, so server and client always render
 * the same motion element (switching element on the client leaves the server's inline
 * `opacity: 0` in place after hydration). `data-reveal` lets a `prefers-reduced-motion` rule in
 * globals.css force the content visible and static — before JS even loads.
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  return (
    <m.div
      data-reveal=""
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
