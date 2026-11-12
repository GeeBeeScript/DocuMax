"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

export interface PdfViewerLabels {
  loading: string;
  error: string;
  page: (n: number, total: number) => string;
  thumbnails: string;
}

/** Renders one page of `pdf` into a canvas sized to `width` CSS pixels (crisp on HiDPI screens). */
function PageCanvas({
  pdf,
  pageNumber,
  width,
  className,
  label,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  className?: string;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | undefined;
    void pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      canvas.current.style.width = `${width}px`;
      task = page.render({ canvas: canvas.current, viewport });
      task.promise.catch(() => undefined); // cancelled renders reject
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width]);
  return <canvas ref={canvas} role="img" aria-label={label} className={cn("block bg-paper", className)} />;
}

/** pdf.js viewer: main page plus a thumbnail strip to switch pages. Loads pdf.js only on the client. */
export function PdfViewer({
  url,
  labels,
  initialPage = 1,
}: {
  url: string;
  labels: PdfViewerLabels;
  /** Page to open on (clamped to the document). */
  initialPage?: number;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [width, setWidth] = useState(640);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const loaded = await loading.promise;
        if (!cancelled) {
          setPdf(loaded);
          setPage((p) => Math.min(Math.max(1, p), loaded.numPages));
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.floor(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (failed) return <p className="p-6 text-sm text-danger">{labels.error}</p>;

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse">
      <div ref={frame} className="min-w-0 flex-1">
        {pdf ? (
          <>
            <PageCanvas
              pdf={pdf}
              pageNumber={page}
              width={width}
              label={labels.page(page, pdf.numPages)}
              className="rounded-lg shadow-card"
            />
            <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
              {labels.page(page, pdf.numPages)}
            </p>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">{labels.loading}</p>
        )}
      </div>
      {pdf && pdf.numPages > 1 && (
        <nav aria-label={labels.thumbnails} className="lg:w-28 lg:shrink-0">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto">
            {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
              <li key={n} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  aria-label={labels.page(n, pdf.numPages)}
                  className={cn(
                    "rounded-md border-2 p-0.5 focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none",
                    n === page ? "border-ink" : "border-transparent hover:border-gray-300",
                  )}
                >
                  <PageCanvas pdf={pdf} pageNumber={n} width={88} label="" />
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
