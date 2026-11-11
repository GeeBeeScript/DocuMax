/**
 * Permanent document problems: the job should not be retried, and `message` is shown to the user as the
 * document's error. Anything else thrown in the pipeline is treated as transient (BullMQ retries).
 */
export type PipelineErrorCode =
  "corrupt_pdf" | "password_protected" | "too_many_pages" | "unreadable_image" | "unsupported_type";

const MESSAGES: Record<PipelineErrorCode, string> = {
  corrupt_pdf: "This PDF is damaged or incomplete and can't be read. Try exporting or scanning it again.",
  password_protected: "This PDF is password-protected. Remove the password and upload it again.",
  too_many_pages: "This document has too many pages",
  unreadable_image: "This image couldn't be read. Try a JPG or PNG export of it.",
  unsupported_type: "This file type isn't supported.",
};

export class PipelineError extends Error {
  constructor(
    public readonly code: PipelineErrorCode,
    message: string = MESSAGES[code],
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export const isPipelineError = (e: unknown): e is PipelineError => e instanceof PipelineError;
