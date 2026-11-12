import { ChevronLeft, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/brand/pill-button";
import { statementsCopy } from "@/content/app";
import { periodLabel, shiftMonth, monthPeriod, type Period } from "@/lib/calc/period";
import { periodQuery } from "../period-params";

const copy = statementsCopy.period;
const input =
  "h-10 rounded-lg border border-input bg-paper px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Period picker as links and GET forms (works without JavaScript; the period lives in the URL): previous/next month,
 * a month field, and a custom date range.
 */
export function PeriodPicker({
  basePath,
  period,
  mode,
}: {
  basePath: string;
  period: Period;
  mode: "month" | "custom";
}) {
  const month = monthPeriod(period.start);
  const href = (p: Period) => `${basePath}${periodQuery(p, "month")}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PillButton href={href(shiftMonth(month, -1))} variant="outline" size="sm" aria-label={copy.previous}>
          <ChevronLeft aria-hidden />
        </PillButton>
        <p className="min-w-40 text-center font-heading text-lg font-bold" aria-live="polite">
          {periodLabel(period)}
        </p>
        <PillButton href={href(shiftMonth(month, 1))} variant="outline" size="sm" aria-label={copy.next}>
          <ChevronRight aria-hidden />
        </PillButton>
        <form method="get" action={basePath} className="ml-auto flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="period-month" className="text-xs">
              {copy.month}
            </Label>
            <input
              id="period-month"
              name="month"
              type="month"
              defaultValue={period.start.slice(0, 7)}
              className={input}
            />
          </div>
          <PillButton type="submit" variant="ghost" size="sm" className="h-10">
            {copy.show}
          </PillButton>
        </form>
      </div>
      <details open={mode === "custom"} className="text-sm">
        <summary className="cursor-pointer font-semibold text-ink-soft">{copy.custom}</summary>
        <form method="get" action={basePath} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="period-from" className="text-xs">
              {copy.from}
            </Label>
            <input
              id="period-from"
              name="from"
              type="date"
              defaultValue={period.start}
              className={input}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="period-to" className="text-xs">
              {copy.to}
            </Label>
            <input
              id="period-to"
              name="to"
              type="date"
              defaultValue={period.end}
              className={input}
              required
            />
          </div>
          <PillButton type="submit" variant="outline" size="sm" className="h-10">
            {copy.show}
          </PillButton>
        </form>
      </details>
    </div>
  );
}
