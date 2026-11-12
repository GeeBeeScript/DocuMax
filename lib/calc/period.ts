/**
 * Reporting periods. Records are dated by `issue_date` (a calendar date, no time), so a period is an inclusive range
 * of ISO dates ("YYYY-MM-DD"). Only "which day is today / this month" depends on the org's time zone. Pure.
 */

export interface Period {
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Inclusive, YYYY-MM-DD. */
  end: string;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function isIsoDate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The calendar month containing `date` (YYYY-MM-DD or YYYY-MM). */
export function monthPeriod(date: string): Period {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
}

/** Today's date in an IANA time zone (falls back to UTC for an unknown zone). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The current month in the org's time zone. */
export const currentMonth = (timeZone: string, now?: Date) => monthPeriod(todayIn(timeZone, now));

/** Shift a month period by `delta` months. */
export function shiftMonth(period: Period, delta: number): Period {
  const [y, m] = period.start.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return monthPeriod(`${Math.floor(index / 12)}-${pad((index % 12) + 1)}`);
}

/** The period of the same length immediately before `period` (a month → the previous month). */
export function previousPeriod(period: Period): Period {
  if (isWholeMonth(period)) return shiftMonth(period, -1);
  const days = dayDiff(period.start, period.end) + 1;
  const end = addDays(period.start, -1);
  return { start: addDays(end, -(days - 1)), end };
}

export const isWholeMonth = (p: Period) => {
  const m = monthPeriod(p.start);
  return m.start === p.start && m.end === p.end;
};

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Every month touched by the period, as month periods (for charts / month columns). */
export function monthsIn(period: Period): Period[] {
  const out: Period[] = [];
  for (let m = monthPeriod(period.start); m.start <= period.end; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export const inPeriod = (date: string | null, p: Period) => date != null && date >= p.start && date <= p.end;

/** Valid, ordered, at most `maxDays` long. Returns an error message or null. */
export function periodError(p: Period, maxDays = 366 * 5): string | null {
  if (!isIsoDate(p.start) || !isIsoDate(p.end)) return "Use dates like 2026-10-01.";
  if (p.end < p.start) return "The end date is before the start date.";
  if (dayDiff(p.start, p.end) + 1 > maxDays) return "Choose a period of at most five years.";
  return null;
}

/** "October 2026", or "Oct 1 – Nov 15, 2026" for a custom range. */
export function periodLabel(p: Period, locale = "en-US"): string {
  const date = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  if (isWholeMonth(p)) return date(p.start, { month: "long", year: "numeric" });
  const sameYear = p.start.slice(0, 4) === p.end.slice(0, 4);
  return `${date(p.start, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${date(p.end, { month: "short", day: "numeric", year: "numeric" })}`;
}
