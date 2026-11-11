"use client";

import dynamic from "next/dynamic";
import { ImageViewer } from "./image-viewer";
import type { PdfViewerLabels } from "./pdf-viewer";

// pdf.js is large and browser-only: load the viewer on demand.
const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PdfViewer), { ssr: false });

const BROWSER_IMAGES = ["image/jpeg", "image/png", "image/webp"];

export type DocumentPreviewLabels = PdfViewerLabels & {
  unavailable: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
};

/** Picks the right viewer for a document: pdf.js for PDFs, zoomable image, or a fallback (e.g. HEIC). */
export function DocumentPreview({
  url,
  mimeType,
  fileName,
  labels,
}: {
  url: string | null;
  mimeType: string;
  fileName: string;
  labels: DocumentPreviewLabels;
}) {
  if (!url) return <p className="p-6 text-sm text-danger">{labels.error}</p>;
  if (mimeType === "application/pdf") return <PdfViewer url={url} labels={labels} />;
  if (BROWSER_IMAGES.includes(mimeType)) return <ImageViewer url={url} alt={fileName} labels={labels} />;
  return <p className="p-6 text-sm text-muted-foreground">{labels.unavailable}</p>;
}
