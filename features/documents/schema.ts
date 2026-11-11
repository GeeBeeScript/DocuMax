import { z } from "zod";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from "@/lib/documents/upload-rules";

export const RequestUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(UPLOAD_MIME_TYPES, "Unsupported file type."),
  sizeBytes: z.number().int().min(1, "File is empty.").max(MAX_UPLOAD_BYTES, "File is larger than 25 MB."),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  entityId: z.uuid().optional(),
});

export const DocumentIdSchema = z.object({ documentId: z.uuid() });

export type RequestUploadInput = z.infer<typeof RequestUploadSchema>;
