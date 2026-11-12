import { currentMonth, monthPeriod, periodError, type Period } from "@/lib/calc/period";

/**
 * The period in the URL: `?month=2026-10` (default: the current month in the org's time zone) or
 * `?from=2026-10-01&to=2026-11-15` for a custom range. Invalid input falls back to the current month with an error.
 */
export interface PeriodSelection {
  period: Period;
  mode: "month" | "custom";
  error: string | null;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parsePeriodParams(params: Params, timeZone: string, now?: Date): PeriodSelection {
  const fallback = currentMonth(timeZone, now);
  const from = first(params.from);
  const to = first(params.to);
  if (from || to) {
    const period = { start: from ?? "", end: to ?? "" };
    const error = periodError(period);
    return error ? { period: fallback, mode: "month", error } : { period, mode: "custom", error: null };
  }
  const month = first(params.month);
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return { period: fallback, mode: "month", error: "Use a month like 2026-10." };
    return { period: monthPeriod(month), mode: "month", error: null };
  }
  return { period: fallback, mode: "month", error: null };
}

/** Query string for a month period or a custom range. */
export function periodQuery(period: Period, mode: "month" | "custom"): string {
  return mode === "month" ? `?month=${period.start.slice(0, 7)}` : `?from=${period.start}&to=${period.end}`;
}
