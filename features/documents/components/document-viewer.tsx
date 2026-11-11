"use client";

import { DocumentPreview } from "@/components/app/document-preview";
import { documentsCopy } from "@/content/app";

/**
 * Client wrapper that supplies the preview copy. The labels contain functions (page numbers), which can't be
 * passed from a Server Component as props.
 */
export function DocumentViewer(props: { url: string | null; mimeType: string; fileName: string }) {
  return <DocumentPreview {...props} labels={documentsCopy.preview} />;
}
