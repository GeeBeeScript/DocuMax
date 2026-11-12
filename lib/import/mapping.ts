import { IMPORT_FIELDS, type ImportField, type ImportMapping } from "./fields";

/** Lower-case, unify separators/symbols: "Invoice No." ≈ "invoice no", "Tax rate (%)" ≈ "tax rate". */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/\(%\)|%/g, "")
    .replace(/[#.]/g, (c) => (c === "#" ? " #" : " "))
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Suggest which CSV column feeds each field: a previously saved mapping wins (when its header is still in the file),
 * then exact synonym matches in field order. A header is used at most once.
 */
export function suggestMapping(headers: readonly string[], saved: ImportMapping = {}): ImportMapping {
  const byNormal = new Map(headers.map((h) => [normalizeHeader(h), h]));
  const used = new Set<string>();
  const mapping: ImportMapping = {};
  for (const field of IMPORT_FIELDS) {
    const previous = saved[field.key];
    if (previous && headers.includes(previous) && !used.has(previous)) {
      mapping[field.key] = previous;
      used.add(previous);
    }
  }
  for (const field of IMPORT_FIELDS) {
    if (mapping[field.key]) continue;
    const candidates = [field.label, ...field.synonyms].map(normalizeHeader);
    const header = candidates.map((c) => byNormal.get(c)).find((h) => h && !used.has(h));
    mapping[field.key] = header ?? null;
    if (header) used.add(header);
  }
  return mapping;
}

/** Missing required fields, and headers that don't exist in the file. */
export function mappingProblems(
  mapping: ImportMapping,
  headers: readonly string[],
  required: readonly ImportField[],
) {
  const missing = required.filter((f) => !mapping[f]);
  const unknown = Object.values(mapping).filter((h): h is string => !!h && !headers.includes(h));
  return { missing, unknown };
}
