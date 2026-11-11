/**
 * Upload rules shared by the browser (FileDropzone), Server Actions and the database CHECK constraints
 * (supabase/migrations/*_entities_documents.sql) — keep the three in sync.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 26_214_400

export const UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

const EXTENSION_TYPES: Record<string, UploadMimeType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** `accept` attribute for file inputs. */
export const UPLOAD_ACCEPT = [...UPLOAD_MIME_TYPES, ...Object.keys(EXTENSION_TYPES).map((e) => `.${e}`)].join(
  ",",
);

export const UPLOAD_TYPES_LABEL = "PDF, JPG, PNG, WEBP or HEIC";

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/**
 * The file's MIME type, falling back to its extension (browsers often report HEIC as "" or
 * application/octet-stream). Returns null for unsupported files.
 */
export function resolveUploadType(name: string, type: string): UploadMimeType | null {
  if ((UPLOAD_MIME_TYPES as readonly string[]).includes(type)) return type as UploadMimeType;
  if (type === "" || type === "application/octet-stream") return EXTENSION_TYPES[extensionOf(name)] ?? null;
  return null;
}

export type UploadRejection = "type" | "size" | "empty";

export function checkUpload(file: { name: string; type: string; size: number }): UploadRejection | null {
  if (!resolveUploadType(file.name, file.type)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return null;
}

export const uploadRejectionMessage: Record<UploadRejection, string> = {
  type: `Unsupported file type. Upload ${UPLOAD_TYPES_LABEL}.`,
  size: "File is larger than 25 MB.",
  empty: "File is empty.",
};

/** Storage-safe file name: ASCII, no path separators, keeps the extension, ≤ 120 chars. */
export function storageFileName(name: string): string {
  const ext = extensionOf(name);
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return `${base || "document"}${ext ? `.${ext}` : ""}`;
}

/** Human-readable size (1 decimal for MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
