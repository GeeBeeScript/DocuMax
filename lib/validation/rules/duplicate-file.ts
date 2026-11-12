import type { RecordForValidation, ValidationContext, ValidationIssue } from "../types";

/** duplicate_file (error): another document in the org has the same file hash. */
export function duplicateFile(_record: RecordForValidation, ctx: ValidationContext): ValidationIssue[] {
  if (ctx.sameFile.length === 0) return [];
  const first = ctx.sameFile[0];
  return [
    {
      code: "duplicate_file",
      severity: "error",
      field: null,
      message: `This exact file was already uploaded as “${first.fileName}”.`,
      details: { documentIds: ctx.sameFile.map((d) => d.documentId) },
    },
  ];
}
