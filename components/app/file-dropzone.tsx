"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { pillButtonVariants } from "@/components/brand/pill-button";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop + file picker. Purely a file source: validation, hashing and uploading happen in the caller
 * (`onFiles` receives every chosen file). The visible button opens the native picker, so keyboard and
 * screen-reader users get the same path.
 */
export function FileDropzone({
  onFiles,
  accept,
  disabled = false,
  labels,
  className,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  disabled?: boolean;
  labels: { title: string; hint: string; choose: string; active: string };
  className?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length && !disabled) onFiles(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <BoardCanvas
      framed
      data-dragging={over || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
        over ? "border-ink bg-yellow-soft" : "border-gray-300",
        disabled && "opacity-50",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-yellow text-ink">
        <UploadCloud className="size-6" aria-hidden />
      </span>
      <p className="font-heading text-lg font-bold">{over ? labels.active : labels.title}</p>
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <input
        ref={input}
        id={inputId}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ""; // allow choosing the same file again
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={cn(pillButtonVariants({ size: "sm" }), "mt-1")}
      >
        {labels.choose}
      </button>
    </BoardCanvas>
  );
}
