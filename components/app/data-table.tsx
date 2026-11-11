import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-align numbers and actions. */
  align?: "left" | "right";
  /** Hide on small screens (the first column always shows). */
  hideOnMobile?: boolean;
  /** Render the cell as the row header (<th scope="row">) — use for the name column. */
  rowHeader?: boolean;
  className?: string;
}

/** Dense app table (44px rows, sticky header, zebra-free with dividers). Columns are data, not markup. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  className,
}: {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  className?: string;
}) {
  const cellClass = (c: DataTableColumn<Row>) =>
    cn(
      "px-4 py-2.5",
      c.align === "right" ? "text-right" : "text-left",
      c.hideOnMobile && "hidden md:table-cell",
      c.className,
    );

  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-gray-200 bg-paper", className)}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-xs tracking-wide text-gray-500 uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn(cellClass(c), "font-semibold")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="h-11 hover:bg-gray-50">
              {columns.map((c) =>
                c.rowHeader ? (
                  <th key={c.key} scope="row" className={cn(cellClass(c), "font-semibold text-ink")}>
                    {c.cell(row)}
                  </th>
                ) : (
                  <td key={c.key} className={cellClass(c)}>
                    {c.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
