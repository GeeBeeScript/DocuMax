import type { RecordForValidation, ValidationContext, ValidationIssue } from "../types";

/** today minus `months` as YYYY-MM-DD (calendar months, clamped to month end). */
export function monthsBefore(today: string, months: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** date_suspicious (warning): issue date in the future or > 18 months old; due date before issue date. */
export function dateSuspicious(record: RecordForValidation, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { issueDate, dueDate } = record;
  if (issueDate && issueDate > ctx.today) {
    issues.push({
      code: "date_suspicious",
      severity: "warning",
      field: "issue_date",
      message: "The issue date is in the future.",
    });
  } else if (issueDate && issueDate < monthsBefore(ctx.today, 18)) {
    issues.push({
      code: "date_suspicious",
      severity: "warning",
      field: "issue_date",
      message: "The issue date is more than 18 months ago.",
    });
  }
  if (issueDate && dueDate && dueDate < issueDate) {
    issues.push({
      code: "date_suspicious",
      severity: "warning",
      field: "due_date",
      message: "The due date is before the issue date.",
    });
  }
  return issues;
}
