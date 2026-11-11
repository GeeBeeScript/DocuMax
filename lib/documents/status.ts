/** Document processing status machine — mirrors docs/DATA_MODEL.md. */
export const DOCUMENT_STATUSES = [
  "uploading",
  "queued",
  "extracting",
  "analyzing",
  "validating",
  "needs_review",
  "ready",
  "failed",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type StatusTone = "neutral" | "progress" | "attention" | "success" | "danger";

export const DOCUMENT_STATUS_META: Record<DocumentStatus, { label: string; tone: StatusTone }> = {
  uploading: { label: "Uploading", tone: "progress" },
  queued: { label: "Queued", tone: "neutral" },
  extracting: { label: "Reading text", tone: "progress" },
  analyzing: { label: "Extracting data", tone: "progress" },
  validating: { label: "Checking", tone: "progress" },
  needs_review: { label: "Needs review", tone: "attention" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/** Confidence bands used by ConfidencePill and review routing defaults. */
export function confidenceBand(score: number, threshold = 0.85): "high" | "medium" | "low" {
  if (score >= threshold) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}
