"use client";

import { useId, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Small highlight next to the label, e.g. "Save 20%". */
  badge?: string;
}

export type SegmentedToggleProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

/** Pill segmented control (radiogroup) — e.g. Monthly / Yearly billing. Arrow keys move selection. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onValueChange,
  className,
  ...aria
}: SegmentedToggleProps<T>) {
  const name = useId();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const next = options[(i + step + options.length) % options.length];
    onValueChange(next.value);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-full border border-gray-200 bg-gray-100 p-1", className)}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            name={name}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-5 font-heading text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ink/30",
              checked ? "bg-paper text-ink shadow-card" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
            {o.badge && (
              <span className="rounded-full bg-yellow px-2 py-0.5 text-xs font-bold text-ink">{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
