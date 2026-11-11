"use client";

import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

const STEPS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

/** Image preview with zoom (scrolls when zoomed in). */
export function ImageViewer({
  url,
  alt,
  labels,
}: {
  url: string;
  alt: string;
  labels: { zoomIn: string; zoomOut: string; resetZoom: string };
}) {
  const [step, setStep] = useState(2); // 1×
  const zoom = STEPS[step];
  const button =
    "inline-flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-paper text-ink hover:bg-gray-50 disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          aria-label={labels.zoomOut}
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className={button}
          aria-label={labels.zoomIn}
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => s + 1)}
        >
          <Plus className="size-4" />
        </button>
        <button type="button" className={button} aria-label={labels.resetZoom} onClick={() => setStep(2)}>
          <RotateCcw className="size-4" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-gray-200 bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would proxy and cache it */}
        <img src={url} alt={alt} style={{ width: `${zoom * 100}%` }} className="block h-auto max-w-none" />
      </div>
    </div>
  );
}
