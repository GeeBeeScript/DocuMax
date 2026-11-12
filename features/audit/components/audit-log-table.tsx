import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { auditCopy } from "@/content/app";
import { fieldLabel, formatValue } from "@/features/review/format";
import { auditChanges, auditCurrency } from "../diff";
import type { AuditEntry } from "../queries";

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const MAX_CHANGES = 4;

/** Where an entry's row can be opened in the app (when there is a page for it). */
function rowHref(entry: AuditEntry): string | null {
  if (entry.action === "delete") return null;
  if (entry.tableName === "records") return `/app/review/${entry.rowId}`;
  if (entry.tableName === "documents") return `/app/documents/${entry.rowId}`;
  return null;
}

/** Org-wide audit log: who changed what, with before → after per changed column. */
export function AuditLogTable({
  entries,
  entitySingular,
  names,
}: {
  entries: readonly AuditEntry[];
  entitySingular: string;
  names: ReadonlyMap<string, string>;
}) {
  return (
    <DataTable
      caption={auditCopy.caption}
      rows={entries}
      getRowKey={(e) => String(e.id)}
      columns={[
        {
          key: "when",
          header: auditCopy.columns.when,
          className: "whitespace-nowrap text-muted-foreground tabular-nums align-top",
          cell: (e) => <time dateTime={e.createdAt}>{dateTime.format(new Date(e.createdAt))}</time>,
        },
        {
          key: "who",
          header: auditCopy.columns.who,
          className: "align-top",
          cell: (e) => (e.actorId ? (e.actorName ?? auditCopy.unknownActor) : auditCopy.system),
        },
        {
          key: "what",
          header: auditCopy.columns.what,
          rowHeader: true,
          className: "align-top",
          cell: (e) => {
            const label = `${auditCopy.tables[e.tableName] ?? e.tableName} ${auditCopy.actions[e.action]}`;
            const href = rowHref(e);
            return href ? (
              <Link href={href} className="underline-offset-2 hover:underline">
                {label}
              </Link>
            ) : (
              label
            );
          },
        },
        {
          key: "changes",
          header: auditCopy.columns.changes,
          hideOnMobile: true,
          className: "align-top",
          cell: (e) => {
            const changes = auditChanges(e);
            const currency = auditCurrency(e);
            const shown = changes.slice(0, MAX_CHANGES);
            const fmt = (key: string, v: unknown) => formatValue(key, v, { currency, names });
            return (
              <ul className="flex flex-col gap-0.5 text-ink-soft">
                {shown.map((c) => (
                  <li key={c.key} className="break-words">
                    <span className="font-semibold text-ink">{fieldLabel(c.key, entitySingular)}:</span>{" "}
                    {e.action === "update" ? (
                      <>
                        <del className="text-muted-foreground">{fmt(c.key, c.before)}</del> →{" "}
                        <ins className="no-underline">{fmt(c.key, c.after)}</ins>
                      </>
                    ) : (
                      fmt(c.key, c.after ?? c.before)
                    )}
                  </li>
                ))}
                {changes.length > MAX_CHANGES && (
                  <li className="text-muted-foreground">{auditCopy.more(changes.length - MAX_CHANGES)}</li>
                )}
              </ul>
            );
          },
        },
      ]}
    />
  );
}
