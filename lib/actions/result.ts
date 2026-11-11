import type { z } from "zod";

/** Return type of every Server Action (docs/CONVENTIONS.md → data access). */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Maps a zod error to an ActionResult with per-field messages. */
export function invalid(error: z.ZodError, message = "Please check the highlighted fields.") {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(message, fieldErrors);
}
