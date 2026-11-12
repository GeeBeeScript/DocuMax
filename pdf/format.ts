import { reportCopy } from "@/content/reports";
import { documentsCopy } from "@/content/app";
import { formatBp } from "@/lib/calc/allocate";
import { formatCents, type Cents } from "@/lib/calc/money";

/** Display formatting for reports (no math). */

export const money = (value: number, currency: string) => formatCents(value as Cents, currency);
export const percent = (bp: number) => `${formatBp(bp)}%`;

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
export const date = (iso: string | null) =>
  iso ? dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—";

export const category = (c: string | null) =>
  c
    ? (documentsCopy.record.categories[c as keyof typeof documentsCopy.record.categories] ?? c)
    : reportCopy.uncategorized;
