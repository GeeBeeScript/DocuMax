import { reviewCopy } from "@/content/app";
import { fieldLabel, formatValue } from "../format";
import type { TimelineEvent } from "../queries";

const copy = reviewCopy.timeline;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Per-record history, newest first: who did what, before → after, and why. */
export function RecordTimeline({
  events,
  currency,
  entitySingular,
  names,
}: {
  events: readonly TimelineEvent[];
  currency: string | null;
  entitySingular: string;
  names: ReadonlyMap<string, string>;
}) {
  return (
    <ol className="flex flex-col gap-0 border-l border-gray-200 pl-4" aria-label={copy.title}>
      {events.map((e) => {
        const who = e.actorName ?? copy.system;
        const what =
          e.action === "extracted"
            ? copy.extracted
            : e.action === "correct"
              ? copy.correct(fieldLabel(e.field ?? "", entitySingular).toLowerCase())
              : copy[e.action];
        return (
          <li key={e.id} className="relative pb-4 text-sm last:pb-0">
            <span
              aria-hidden
              className="absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full border-2 border-paper bg-gray-300"
            />
            <p>
              {e.action !== "extracted" && <span className="font-semibold text-ink">{who} </span>}
              <span className="text-ink-soft">{what}</span>
              <span className="text-muted-foreground"> · {dateTime.format(new Date(e.createdAt))}</span>
            </p>
            {e.action === "correct" && e.field && (
              <p className="mt-0.5 text-ink-soft">
                <del className="text-muted-foreground">
                  {formatValue(e.field, e.before, { currency, names })}
                </del>{" "}
                →{" "}
                <ins className="font-semibold text-ink no-underline">
                  {formatValue(e.field, e.after, { currency, names })}
                </ins>
              </p>
            )}
            {e.reason && <p className="mt-0.5 text-ink-soft italic">“{e.reason}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
