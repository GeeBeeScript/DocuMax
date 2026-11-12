import { cents, formatCents } from "@/lib/calc/money";

/** Money for messages (formatting only). */
export const money = (value: number, currency: string | null) => formatCents(cents(value), currency ?? "USD");
