import Link from "next/link";
import { Split } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { Money } from "@/components/app/money";
import { StatTile } from "@/components/app/stat-tile";
import { documentsCopy, statementsCopy } from "@/content/app";
import { formatBp } from "@/lib/calc/allocate";
import { formatCents, type Cents } from "@/lib/calc/money";
import type { StatementData } from "@/lib/calc/statement";

const copy = statementsCopy;
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const categoryLabel = (c: string | null) =>
  c
    ? (documentsCopy.record.categories[c as keyof typeof documentsCopy.record.categories] ?? c)
    : copy.uncategorized;

/** An entity's figures for a period, straight from the StatementData view-model (no math here). */
export function EntityStatement({ data }: { data: StatementData }) {
  const { summary, currency } = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={copy.tiles.gross}
          value={<Money value={summary.gross} currency={currency} />}
          emphasis
        />
        <StatTile label={copy.tiles.net} value={<Money value={summary.net} currency={currency} />} />
        <StatTile label={copy.tiles.tax} value={<Money value={summary.tax} currency={currency} />} />
        <StatTile label={copy.tiles.records} value={summary.records} />
      </div>
      {data.otherCurrencies.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {copy.otherCurrencies(
            data.otherCurrencies
              .map((c) => (c.currency ? formatCents(c.gross as Cents, c.currency) : `${c.records}`))
              .join(", "),
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="by-category" className="flex flex-col gap-3">
          <h2 id="by-category" className="font-heading text-lg font-bold">
            {copy.categories.title}
          </h2>
          <ul
            className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-4"
            aria-label={copy.categories.caption}
          >
            {data.categories.map((c) => (
              <li key={c.category ?? "none"} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{categoryLabel(c.category)}</span>
                  <span className="tabular-nums">
                    <Money value={c.gross} currency={currency} />{" "}
                    <span className="text-muted-foreground">· {formatBp(c.shareBp)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                  <div
                    className="h-full rounded-full bg-yellow"
                    style={{ width: `${Math.max(0, c.shareBp) / 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="top-suppliers" className="flex flex-col gap-3">
          <h2 id="top-suppliers" className="font-heading text-lg font-bold">
            {copy.suppliers.title}
          </h2>
          <ol className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-paper px-4">
            {data.suppliers.slice(0, 5).map((s) => (
              <li
                key={s.supplier ?? "none"}
                className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.supplier ?? copy.unknownSupplier}</span>
                  <span className="text-xs text-muted-foreground">{copy.suppliers.records(s.records)}</span>
                </span>
                <Money value={s.gross} currency={currency} />
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="statement-lines" className="flex flex-col gap-3">
        <h2 id="statement-lines" className="font-heading text-lg font-bold">
          {copy.lines.title}
        </h2>
        <DataTable
          caption={copy.lines.caption}
          rows={data.lines}
          getRowKey={(l) => `${l.recordId}-${l.lineId ?? "r"}`}
          columns={[
            {
              key: "date",
              header: copy.lines.date,
              className: "whitespace-nowrap tabular-nums",
              cell: (l) => dateFormat.format(new Date(`${l.date}T00:00:00Z`)),
            },
            {
              key: "supplier",
              header: copy.lines.supplier,
              rowHeader: true,
              cell: (l) => (
                <Link href={`/app/review/${l.recordId}`} className="underline-offset-2 hover:underline">
                  {l.supplier ?? copy.unknownSupplier}
                  {l.invoiceNumber && (
                    <span className="font-normal text-muted-foreground"> · {l.invoiceNumber}</span>
                  )}
                </Link>
              ),
            },
            {
              key: "description",
              header: copy.lines.description,
              hideOnMobile: true,
              cell: (l) => l.description ?? <span className="text-muted-foreground">—</span>,
            },
            {
              key: "category",
              header: copy.lines.category,
              hideOnMobile: true,
              cell: (l) => categoryLabel(l.category),
            },
            {
              key: "amount",
              header: copy.lines.amount,
              align: "right",
              cell: (l) => (
                <span className="inline-flex items-center gap-1.5">
                  {l.split && (
                    <span title={copy.lines.splitHint}>
                      <Split className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="sr-only">{copy.lines.split}: </span>
                    </span>
                  )}
                  <Money value={l.gross} currency={currency} />
                </span>
              ),
            },
          ]}
        />
        <p className="text-xs text-muted-foreground">{copy.onlyApproved}</p>
      </section>
    </div>
  );
}
