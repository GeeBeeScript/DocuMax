import { cn } from "@/lib/utils";
import { formatCents, type Cents } from "@/lib/calc/money";
import { Logo } from "@/components/brand/logo";

export type StatementMockProps = {
  title: string;
  entity: string;
  period: string;
  rows: readonly { category: string; amount: Cents }[];
  total: Cents;
  pages: number;
  className?: string;
};

/** Stacked multi-page PDF statement — the polished output. */
export function StatementMock({ title, entity, period, rows, total, pages, className }: StatementMockProps) {
  return (
    <div aria-hidden className={cn("relative w-60", className)}>
      {/* back pages */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-md border border-gray-200 bg-paper" />
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-md border border-gray-200 bg-paper" />
      <div className="relative rounded-md border border-gray-200 bg-paper p-4 text-[10px] text-ink shadow-card">
        <div className="flex items-center justify-between border-b-2 border-yellow pb-2">
          <Logo markOnly className="[&_svg]:size-5" />
          <span className="font-semibold text-ink-soft">{period}</span>
        </div>
        <p className="mt-2 font-heading text-xs font-bold">{title}</p>
        <p className="text-gray-500">{entity}</p>
        <table className="mt-2 w-full">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-1 py-0.5 font-semibold">Category</th>
              <th className="px-1 py-0.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-gray-100">
                <td className="px-1 py-0.5">{r.category}</td>
                <td className="px-1 py-0.5 text-right tabular-nums">{formatCents(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="px-1 pt-1">Total</td>
              <td className="px-1 pt-1 text-right tabular-nums">{formatCents(total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 text-center text-gray-500">Page 1 of {pages}</p>
      </div>
    </div>
  );
}
