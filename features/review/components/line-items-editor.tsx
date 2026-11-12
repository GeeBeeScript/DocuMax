"use client";

import { Plus, Trash2 } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import { documentsCopy, reviewCopy } from "@/content/app";
import { cn } from "@/lib/utils";
import { emptyLine, fieldInputId, type DraftLine, type DraftLineField } from "../draft";

const copy = reviewCopy.item.lines;
const columns = documentsCopy.record.lines;

const cellInput =
  "h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-ink outline-none hover:border-gray-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:hover:border-transparent aria-invalid:border-danger aria-invalid:bg-danger-soft";

const CELLS: { key: DraftLineField; header: string; numeric?: boolean; className?: string }[] = [
  { key: "description", header: columns.description, className: "min-w-40" },
  { key: "quantity", header: columns.quantity, numeric: true, className: "w-20" },
  { key: "unit_price_cents", header: columns.unitPrice, numeric: true, className: "w-28" },
  { key: "amount_cents", header: columns.amount, numeric: true, className: "w-28" },
  { key: "category", header: columns.category, className: "w-44" },
];

/**
 * Editable line items. Each cell is a labelled input (ids follow `fieldInputId`, so issues can focus them); `errors`
 * holds parse errors and `flagged` the cells an issue points at (e.g. `lines[1].amount_cents`).
 */
export function LineItemsEditor({
  lines,
  onChange,
  errors,
  flagged,
  disabled,
}: {
  lines: readonly DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  errors: Record<string, string>;
  flagged: ReadonlySet<string>;
  disabled?: boolean;
}) {
  const update = (index: number, key: DraftLineField, value: string) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)));

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-paper">
          <table className="w-full text-sm">
            <caption className="sr-only">{copy.caption}</caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs tracking-wide text-gray-500 uppercase">
              <tr>
                <th scope="col" className="w-8 px-2 py-2 text-left font-semibold">
                  #
                </th>
                {CELLS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn("px-2 py-2 font-semibold", c.numeric ? "text-right" : "text-left")}
                  >
                    {c.header}
                  </th>
                ))}
                <th scope="col" className="w-10">
                  <span className="sr-only">{copy.removeHeader}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, i) => (
                <tr key={line.key}>
                  <td className="px-2 text-xs text-gray-500 tabular-nums">{i + 1}</td>
                  {CELLS.map((c) => {
                    const path = `lines[${i}].${c.key}`;
                    const error = errors[path];
                    const invalid = Boolean(error) || flagged.has(path);
                    const common = {
                      id: fieldInputId(path),
                      "aria-label": copy.cell(c.header, i + 1),
                      "aria-invalid": invalid || undefined,
                      title: error,
                      disabled,
                      value: line[c.key],
                    };
                    return (
                      <td key={c.key} className={cn("px-1 py-1", c.className)}>
                        {c.key === "category" ? (
                          <select
                            {...common}
                            className={cellInput}
                            onChange={(e) => update(i, c.key, e.target.value)}
                          >
                            <option value="">—</option>
                            {Object.entries(documentsCopy.record.categories).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            {...common}
                            inputMode={c.numeric ? "decimal" : undefined}
                            autoComplete="off"
                            className={cn(cellInput, c.numeric && "text-right tabular-nums")}
                            onChange={(e) => update(i, c.key, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 text-right">
                    {!disabled && (
                      <button
                        type="button"
                        aria-label={copy.remove(i + 1)}
                        onClick={() => onChange(lines.filter((_, j) => j !== i))}
                        className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-danger focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <PillButton
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange([...lines, emptyLine()])}
        >
          <Plus aria-hidden /> {copy.add}
        </PillButton>
      )}
    </div>
  );
}
