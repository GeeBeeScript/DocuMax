import type { RecordForValidation, ValidationIssue } from "../types";

/** no_entity (warning): the record isn't assigned to a property/job (no match, none picked). */
export function noEntity(record: RecordForValidation): ValidationIssue[] {
  if (record.entityId) return [];
  return [
    {
      code: "no_entity",
      severity: "warning",
      field: "entity",
      message: "Not assigned to a property or job yet.",
    },
  ];
}
