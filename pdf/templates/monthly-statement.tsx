import type { ReactElement } from "react";
import { reportCopy } from "@/content/reports";
import { runningTotals } from "@/lib/calc/money";
import type { StatementData, StatementLine } from "@/lib/calc/statement";
import { ReportHeader } from "../components/report-header";
import { ReportTable, type ReportColumn } from "../components/report-table";
import { ReportTiles } from "../components/report-tiles";
import { TotalsBlock } from "../components/totals-block";
import type { ReportDocument } from "../document";
import { category, date, money, percent } from "../format";
import { H, paginateTable } from "../layout";

const copy = reportCopy.statement;
const SUPPLIERS = 5;

/** Monthly cost statement for one entity: summary, categories, top suppliers, then every cost line. */
export function monthlyStatement(
  data: StatementData,
  { entitySingular }: { entitySingular: string },
): ReportDocument {
  const cur = data.currency;
  const suppliers = data.suppliers.slice(0, SUPPLIERS);
  const categoryRows = Math.max(data.categories.length, 1) + (data.categories.length ? 1 : 0);
  const before =
    H.title +
    H.gap +
    H.tiles +
    H.gap +
    H.heading +
    H.head +
    categoryRows * H.row +
    H.gap +
    (suppliers.length ? H.heading + H.head + suppliers.length * H.row + H.gap : 0);
  const anySplit = data.lines.some((l) => l.split);
  const after = H.totals + (data.otherCurrencies.length ? H.note : 0) + (anySplit ? H.note : 0);
  const { chunks, pageCount } = paginateTable({ rows: data.lines.length, before, after });
  const running = runningTotals(data.lines.map((l) => l.gross));

  const lineColumns: ReportColumn<StatementLine>[] = [
    { key: "date", header: copy.columns.date, width: 25, cell: (l) => date(l.date) },
    {
      key: "supplier",
      header: copy.columns.supplier,
      width: 42,
      cell: (l) =>
        l.invoiceNumber
          ? `${l.supplier ?? reportCopy.unknownSupplier} · ${l.invoiceNumber}`
          : (l.supplier ?? reportCopy.unknownSupplier),
    },
    { key: "description", header: copy.columns.description, cell: (l) => l.description ?? "—" },
    { key: "category", header: copy.columns.category, width: 34, cell: (l) => category(l.category) },
    {
      key: "amount",
      header: copy.columns.amount,
      width: 26,
      numeric: true,
      cell: (l) => `${money(l.gross, cur)}${l.split ? " *" : ""}`,
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
              title={data.entity.name}
              subtitle={[data.entity.address, data.entity.clientName].filter(Boolean).join(" · ") || null}
              facts={[
                [reportCopy.period, data.period.label],
                ...(data.entity.code ? ([[entitySingular, data.entity.code]] as [string, string][]) : []),
              ]}
            />
            <div className="gap" />
            <ReportTiles
              tiles={[
                { label: copy.tiles.gross, value: money(data.summary.gross, cur), emphasis: true },
                { label: copy.tiles.net, value: money(data.summary.net, cur) },
                { label: copy.tiles.tax, value: money(data.summary.tax, cur) },
                { label: copy.tiles.records, value: String(data.summary.records) },
              ]}
            />
            <div className="gap" />
            <h2 className="heading">{copy.categories}</h2>
            <ReportTable
              caption={copy.categories}
              rows={data.categories}
              getKey={(c) => c.category ?? "none"}
              empty={copy.empty}
              columns={[
                { key: "category", header: copy.categoryColumns.category, cell: (c) => category(c.category) },
                {
                  key: "net",
                  header: copy.categoryColumns.net,
                  width: 30,
                  numeric: true,
                  cell: (c) => money(c.net, cur),
                },
                {
                  key: "tax",
                  header: copy.categoryColumns.tax,
                  width: 26,
                  numeric: true,
                  cell: (c) => money(c.tax, cur),
                },
                {
                  key: "gross",
                  header: copy.categoryColumns.gross,
                  width: 30,
                  numeric: true,
                  cell: (c) => money(c.gross, cur),
                },
                {
                  key: "share",
                  header: copy.categoryColumns.share,
                  width: 20,
                  numeric: true,
                  cell: (c) => percent(c.shareBp),
                },
              ]}
              footer={
                data.categories.length
                  ? {
                      label: reportCopy.totals.gross,
                      values: {
                        net: money(data.summary.net, cur),
                        tax: money(data.summary.tax, cur),
                        gross: money(data.summary.gross, cur),
                        share: "100%",
                      },
                    }
                  : null
              }
            />
            <div className="gap" />
            {suppliers.length > 0 && (
              <>
                <h2 className="heading">{copy.suppliers}</h2>
                <ReportTable
                  caption={copy.suppliers}
                  rows={suppliers}
                  getKey={(s) => s.supplier ?? "none"}
                  columns={[
                    {
                      key: "supplier",
                      header: copy.supplierColumns.supplier,
                      cell: (s) => s.supplier ?? reportCopy.unknownSupplier,
                    },
                    {
                      key: "records",
                      header: copy.supplierColumns.records,
                      width: 24,
                      numeric: true,
                      cell: (s) => String(s.records),
                    },
                    {
                      key: "gross",
                      header: copy.supplierColumns.gross,
                      width: 30,
                      numeric: true,
                      cell: (s) => money(s.gross, cur),
                    },
                  ]}
                />
                <div className="gap" />
              </>
            )}
          </>
        )}
        {chunk && (
          <>
            {chunk.first && <h2 className="heading">{copy.lines}</h2>}
            <ReportTable
              caption={copy.lines}
              columns={lineColumns}
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
                    { label: reportCopy.totals.net, value: money(data.summary.net, cur) },
                    { label: reportCopy.totals.tax, value: money(data.summary.tax, cur) },
                    { label: reportCopy.totals.gross, value: money(data.summary.gross, cur) },
                  ]}
                />
                {anySplit && <p className="note">{copy.splitNote(entitySingular)}</p>}
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
