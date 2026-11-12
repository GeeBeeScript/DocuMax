import type { ReactElement } from "react";
import { reportCopy } from "@/content/reports";
import { runningTotals } from "@/lib/calc/money";
import type { QuoteData, QuoteLine } from "@/lib/calc/quote";
import { ReportHeader } from "../components/report-header";
import { ReportTable, type ReportColumn } from "../components/report-table";
import { TotalsBlock } from "../components/totals-block";
import type { ReportDocument } from "../document";
import { category, date, money, percent } from "../format";
import { H, paginateTable } from "../layout";

const copy = reportCopy.quote;

/**
 * Quote for a job: priced lines (cost + markup — the client sees only the price), subtotal, tax, total, notes.
 * Costs and markup never appear on the document.
 */
export function quote(data: QuoteData): ReportDocument {
  const cur = data.currency;
  const before = H.title + H.gap;
  const after = H.totals + (data.notes ? H.gap + H.notes : 0);
  const { chunks, pageCount } = paginateTable({ rows: data.lines.length, before, after });
  const running = runningTotals(data.lines.map((l) => l.price));
  const columns: ReportColumn<QuoteLine>[] = [
    { key: "description", header: copy.columns.description, cell: (l) => l.description || "—" },
    { key: "category", header: copy.columns.category, width: 40, cell: (l) => category(l.category) },
    {
      key: "amount",
      header: copy.columns.amount,
      width: 32,
      numeric: true,
      cell: (l) => money(l.price, cur),
    },
  ];

  const pages: ReactElement[] = [];
  for (let p = 0; p < pageCount; p++) {
    const chunk = chunks.find((c) => c.page === p);
    pages.push(
      <>
        {p === 0 && (
          <>
            <ReportHeader
              eyebrow={`${copy.title} ${data.number}`}
              title={data.entity.clientName ?? data.entity.name}
              subtitle={
                [data.entity.clientName ? `${copy.job}: ${data.entity.name}` : null, data.entity.address]
                  .filter(Boolean)
                  .join(" · ") || null
              }
              facts={[
                [copy.number, data.number],
                [copy.issued, date(data.issueDate)],
                [copy.validUntil, date(data.validUntil)],
              ]}
            />
            <div className="gap" />
          </>
        )}
        {chunk && (
          <>
            {chunk.first && <h2 className="heading">{copy.lines}</h2>}
            <ReportTable
              caption={copy.lines}
              columns={columns}
              rows={data.lines.slice(chunk.start, chunk.end)}
              getKey={(l) => `${l.recordId}-${l.lineId ?? "r"}`}
              empty={copy.empty}
              broughtForward={chunk.first ? null : money(running[chunk.start - 1]!, cur)}
              carriedForward={chunk.last ? null : money(running[chunk.end - 1]!, cur)}
            />
            {chunk.last && (
              <>
                <TotalsBlock
                  rows={[
                    { label: copy.subtotal, value: money(data.subtotal, cur) },
                    {
                      label: copy.tax(percent(data.taxRateBp).replace("%", "")),
                      value: money(data.tax, cur),
                    },
                    { label: copy.total, value: money(data.total, cur) },
                  ]}
                />
                {data.notes && (
                  <>
                    <div className="gap" />
                    <div className="notes block">
                      <h2>{copy.notes}</h2>
                      <p>{data.notes}</p>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </>,
    );
  }
  return { title: copy.title, pages };
}
