"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import { SegmentedToggle } from "@/components/brand/segmented-toggle";
import { PLANS, yearlyDiscountPercent, type BillingInterval, type Plan } from "@/lib/billing/plans";
import { formatCents } from "@/lib/calc/money";
import type { PlanCardContent } from "@/content/types";
import { cn } from "@/lib/utils";

function PriceLine({ plan, interval }: { plan: Plan; interval: BillingInterval }) {
  if (!plan.price) {
    return <p className="font-heading text-4xl font-extrabold">Custom</p>;
  }
  const amount = plan.price[interval];
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className="font-heading text-4xl font-extrabold tabular-nums">
          {formatCents(amount).replace(/\.00$/, "")}
        </span>
        <span className="text-sm text-muted-foreground">/ month</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {amount === 0 ? "Free forever" : interval === "yearly" ? "billed yearly" : "billed monthly"}
      </p>
    </div>
  );
}

export function PlanCard({ card, interval }: { card: PlanCardContent; interval: BillingInterval }) {
  const plan = PLANS[card.planId];
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={cn(
        "relative flex h-full flex-col gap-6 rounded-3xl border bg-paper p-6",
        card.highlighted ? "border-2 border-ink shadow-lift" : "border-gray-200 shadow-card",
      )}
    >
      {card.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-yellow px-3 py-1 text-xs font-bold text-ink">
          {card.badge}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <h2 id={`plan-${plan.id}`} className="text-2xl font-bold">
          {plan.name}
        </h2>
        <p className="min-h-10 text-sm text-muted-foreground">{card.tagline}</p>
      </div>
      <PriceLine plan={plan} interval={interval} />
      <p className="text-sm font-semibold">
        {plan.documentsPerMonth === null
          ? "Custom document volume"
          : `${plan.documentsPerMonth.toLocaleString("en-US")} documents / month`}
        {plan.seats !== null && <span className="font-normal text-muted-foreground"> · {plan.seats} {plan.seats === 1 ? "seat" : "seats"}</span>}
      </p>
      <PillButton href={card.cta.href} variant={card.highlighted ? "primary" : "outline"} className="w-full">
        {card.cta.label}
      </PillButton>
      <div className="border-t border-gray-200 pt-5">
        <p className="mb-3 text-sm font-semibold">{card.featuresHeading}</p>
        <ul className="flex flex-col gap-2.5">
          {card.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** Monthly/yearly toggle + plan cards. Prices and caps come from lib/billing/plans. */
export function PricingCards({ cards, className }: { cards: readonly PlanCardContent[]; className?: string }) {
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const discount = yearlyDiscountPercent();

  return (
    <div className={cn("flex flex-col items-center gap-10", className)}>
      <SegmentedToggle
        aria-label="Billing interval"
        value={interval}
        onValueChange={setInterval}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly", badge: discount ? `Save ${discount}%` : undefined },
        ]}
      />
      <div className="grid w-full gap-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <PlanCard key={card.planId} card={card} interval={interval} />
        ))}
      </div>
    </div>
  );
}
