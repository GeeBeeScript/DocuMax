"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion, type Variants } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export type StaggerProps = {
  children: ReactNode;
  className?: string;
  /** Delay between children in seconds. */
  step?: number;
  as?: "div" | "ul" | "ol";
};

/** Reveals its <StaggerItem> children one after another when scrolled into view. */
export function Stagger({ children, className, step = 0.08, as = "div" }: StaggerProps) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{children}</Tag>;

  const MotionTag = m[as];
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{children}</Tag>;

  const MotionTag = m[as];
  return (
    <MotionTag className={className} variants={item}>
      {children}
    </MotionTag>
  );
}
