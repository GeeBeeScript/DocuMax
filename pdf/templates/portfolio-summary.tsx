import type { ReactElement } from "react";
import { reportCopy } from "@/content/reports";
import { runningTotals } from "@/lib/calc/money";
import type { PortfolioData, PortfolioRow } from "@/lib/calc/statement";
import { ReportHeader } from "../components/report-header";
import { ReportTable, type ReportColumn } from "../components/report-table";
import { ReportTiles } from "../components/report-tiles";
import { TotalsBlock } from "../components/totals-block";
import type { ReportDocument } from "../document";
import { money } from "../format";
import { H, paginateTable } from "../layout";

const copy = reportCopy.summary;

/** All entities' totals for a period, largest first; the grand total equals the sum of the rows (lib/calc). */
export function portfolioSummary(
  data: PortfolioData,
  { entityPlural }: { entityPlural: string },
): ReportDocument {
  const cur = data.currency;
  const before = H.title + H.gap + H.tiles + H.gap;
  const after = H.totals + (data.otherCurrencies.length ? H.note : 0);
  const { chunks, pageCount } = paginateTable({ rows: data.rows.length, before, after });
  const running = runningTotals(data.rows.map((r) => r.totals.gross));
  const columns: ReportColumn<PortfolioRow>[] = [
    { key: "name", header: copy.columns.name, cell: (r) => r.entity?.name ?? copy.unassigned },
    { key: "code", header: copy.columns.code, width: 24, cell: (r) => r.entity?.code ?? "—" },
    {
      key: "records",
      header: copy.columns.records,
      width: 20,
      numeric: true,
      cell: (r) => String(r.totals.records),
    },
    { key: "net", header: copy.columns.net, width: 30, numeric: true, cell: (r) => money(r.totals.net, cur) },
    { key: "tax", header: copy.columns.tax, width: 24, numeric: true, cell: (r) => money(r.totals.tax, cur) },
    {
      key: "gross",
      header: copy.columns.gross,
      width: 30,
      numeric: true,
      cell: (r) => money(r.totals.gross, cur),
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
              eyebrow={copy.title}
              title={data.org.name}
              subtitle={copy.entities(entityPlural)}
              facts={[[reportCopy.period, data.period.label]]}
            />
            <div className="gap" />
            <ReportTiles
              tiles={[
                {
                  label: reportCopy.statement.tiles.gross,
                  value: money(data.total.gross, cur),
                  emphasis: true,
                },
                { label: reportCopy.statement.tiles.net, value: money(data.total.net, cur) },
                { label: reportCopy.statement.tiles.tax, value: money(data.total.tax, cur) },
                { label: reportCopy.statement.tiles.records, value: String(data.total.records) },
              ]}
            />
            <div className="gap" />
          </>
        )}
        {chunk && (
          <>
            {chunk.first && <h2 className="heading">{copy.entities(entityPlural)}</h2>}
            <ReportTable
              caption={copy.entities(entityPlural)}
              columns={columns}
              rows={data.rows.slice(chunk.start, chunk.end)}
              getKey={(r) => r.entity?.id ?? "unassigned"}
              empty={copy.empty}
              broughtForward={chunk.first ? null : money(running[chunk.start - 1]!, cur)}
              carriedForward={chunk.last ? null : money(running[chunk.end - 1]!, cur)}
            />
            {chunk.last && (
              <>
                <TotalsBlock
                  rows={[
                    { label: reportCopy.totals.net, value: money(data.total.net, cur) },
                    { label: reportCopy.totals.tax, value: money(data.total.tax, cur) },
                    { label: reportCopy.totals.gross, value: money(data.total.gross, cur) },
                  ]}
                />
                {data.otherCurrencies.length > 0 && (
                  <p className="note">
                    {reportCopy.otherCurrencies(
                      data.otherCurrencies
                        .map((c) => (c.currency ? money(c.gross, c.currency) : String(c.records)))
                        .join(", "),
                    )}
                  </p>
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
