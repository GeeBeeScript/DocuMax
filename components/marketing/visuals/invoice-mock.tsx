import { cn } from "@/lib/utils";
import { formatCents, type Cents } from "@/lib/calc/money";

export type InvoiceMockProps = {
  supplier: string;
  number: string;
  date: string;
  lines: readonly { description: string; amount: Cents }[];
  total: Cents;
  className?: string;
};

/** A slightly crumpled-looking paper invoice — the "messy input" in mockups. */
export function InvoiceMock({ supplier, number, date, lines, total, className }: InvoiceMockProps) {
  return (
    <div
      aria-hidden
      className={cn("w-56 rotate-[-3deg] rounded-md bg-paper p-4 text-[10px] text-ink shadow-note", className)}
    >
      <div className="flex items-start justify-between">
        <p className="font-heading text-xs font-bold">{supplier}</p>
        <p className="font-semibold text-ink-soft">INVOICE</p>
      </div>
      <p className="mt-1 text-gray-500">
        {number} · {date}
      </p>
      <div className="mt-3 space-y-1.5 border-t border-dashed border-gray-300 pt-2">
        {lines.map((l) => (
          <div key={l.description} className="flex justify-between gap-2">
            <span className="truncate text-gray-600">{l.description}</span>
            <span className="tabular-nums">{formatCents(l.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatCents(total)}</span>
      </div>
      {/* scribble lines to suggest handwriting / noise */}
      <div className="mt-3 space-y-1">
        <div className="h-1 w-3/4 rounded bg-gray-200" />
        <div className="h-1 w-1/2 rounded bg-gray-200" />
      </div>
    </div>
  );
}
