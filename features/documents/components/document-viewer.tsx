"use client";

import { useState } from "react";
import { DocumentPreview } from "@/components/app/document-preview";
import { documentsCopy } from "@/content/app";

/**
 * Client wrapper that supplies the preview copy (labels contain functions, which can't be passed from a Server
 * Component). It also pins the first signed URL: page refreshes mint a new URL each time, and swapping it
 * would reload the PDF for nothing — the file never changes.
 */
export function DocumentViewer(props: {
  url: string | null;
  mimeType: string;
  fileName: string;
  initialPage?: number;
}) {
  const [url] = useState(props.url);
  return <DocumentPreview {...props} url={url} labels={documentsCopy.preview} />;
}
