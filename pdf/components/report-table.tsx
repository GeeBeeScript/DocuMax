import type { ReactNode } from "react";
import { reportCopy } from "@/content/reports";

export interface ReportColumn<Row> {
  key: string;
  header: string;
  /** Width in mm; the remaining width goes to columns without one. */
  width?: number;
  numeric?: boolean;
  cell: (row: Row) => ReactNode;
}

/**
 * One page's chunk of a report table: the header row repeats on every page, rows have a fixed height and never
 * split, and chunk boundaries show brought-forward / carried-forward subtotals (formatted values from lib/calc
 * running totals). `footer` renders a total row inside the table (small tables that fit on a page).
 */
export function ReportTable<Row>({
  caption,
  columns,
  rows,
  getKey,
  broughtForward,
  carriedForward,
  footer,
  empty,
}: {
  caption: string;
  columns: readonly ReportColumn<Row>[];
  rows: readonly Row[];
  getKey: (row: Row) => string;
  broughtForward?: string | null;
  carriedForward?: string | null;
  footer?: { label: string; values: Record<string, string> } | null;
  empty?: string;
}) {
  const span = columns.length - 1;
  return (
    <table className="report">
      <caption style={{ display: "none" }}>{caption}</caption>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={c.width ? { width: `${c.width}mm` } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.numeric ? "num" : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {broughtForward != null && (
          <tr className="carry">
            <td colSpan={span}>{reportCopy.broughtForward}</td>
            <td className="num">{broughtForward}</td>
          </tr>
        )}
        {rows.length === 0 && empty && (
          <tr className="empty">
            <td colSpan={columns.length}>{empty}</td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={getKey(row)}>
            {columns.map((c) => (
              <td key={c.key} className={c.numeric ? "num" : undefined}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
        {carriedForward != null && (
          <tr className="carry">
            <td colSpan={span}>{reportCopy.carriedForward}</td>
            <td className="num">{carriedForward}</td>
          </tr>
        )}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="total">
            {columns.map((c, i) => (
              <td key={c.key} className={c.numeric ? "num" : undefined}>
                {i === 0 ? footer.label : (footer.values[c.key] ?? "")}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
