"use client";

import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import { PLANS, PLAN_IDS } from "@/lib/billing/plans";
import type { ComparisonGroup, ComparisonValue, PlanCardContent } from "@/content/types";
import { cn } from "@/lib/utils";

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true)
    return <Check aria-label="Included" className="mx-auto size-5 text-ink" strokeWidth={2.5} />;
  if (value === false) return <Minus aria-label="Not included" className="mx-auto size-4 text-gray-300" />;
  return <span className="text-sm font-medium">{value}</span>;
}

/** Expandable full feature comparison with a sticky plan header row. */
export function PricingTable({
  groups,
  cards,
  defaultOpen = false,
}: {
  groups: readonly ComparisonGroup[];
  cards: readonly PlanCardContent[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ctaFor = (id: string) => cards.find((c) => c.planId === id)?.cta;

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="compare-table"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-ink px-6 py-3 font-heading font-semibold hover:bg-ink/5 focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none"
      >
        Compare all features
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      <div id="compare-table" hidden={!open} className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Plan feature comparison</caption>
          <thead className="sticky top-16 z-10 bg-paper lg:top-18">
            <tr className="border-b-2 border-ink">
              <th scope="col" className="w-1/3 py-4 pr-4 font-heading text-lg font-bold">
                Plans
              </th>
              {PLAN_IDS.map((id) => {
                const cta = ctaFor(id);
                return (
                  <th key={id} scope="col" className="px-2 py-4 text-center">
                    <span className="block font-heading text-lg font-bold">{PLANS[id].name}</span>
                    {cta && (
                      <PillButton href={cta.href} size="sm" variant="outline" className="mt-2">
                        {cta.label}
                      </PillButton>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th
                  colSpan={PLAN_IDS.length + 1}
                  scope="colgroup"
                  className="bg-gray-50 px-3 pt-6 pb-2 font-heading font-bold"
                >
                  {g.title}
                </th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.label} className="border-b border-gray-200">
                  <th scope="row" className="py-3 pr-4 pl-3 text-sm font-normal">
                    {row.label}
                  </th>
                  {PLAN_IDS.map((id) => (
                    <td key={id} className="px-2 py-3 text-center">
                      <Cell value={row.values[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
