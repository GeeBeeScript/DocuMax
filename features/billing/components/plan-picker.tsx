"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import { billingCopy } from "@/content/app";
import { planCards } from "@/content/pricing";
import { PLANS, type BillingInterval, type PlanId } from "@/lib/billing/plans";
import { formatCents } from "@/lib/calc/money";
import { cn } from "@/lib/utils";
import { openBillingPortal, startCheckout } from "../actions";

const ORDER: PlanId[] = ["free", "pro", "business", "enterprise"];

/** Plan cards with a monthly/yearly toggle. Owners go to Stripe Checkout (or the portal when already paying). */
export function PlanPicker({ current, canManage }: { current: PlanId; canManage: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [pending, startTransition] = useTransition();
  const go = (action: () => ReturnType<typeof openBillingPortal>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) window.location.assign(result.data.url);
      else toast.error(result.error);
    });
  const rank = (id: PlanId) => ORDER.indexOf(id);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="flex gap-1 self-start rounded-full bg-gray-100 p-1"
      >
        {(["monthly", "yearly"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setInterval(i)}
            className={cn(
              "h-8 rounded-full px-3 text-sm font-semibold text-ink-soft",
              interval === i && "bg-paper text-ink shadow-sm",
            )}
          >
            {billingCopy.intervals[i]}
          </button>
        ))}
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((id) => {
          const plan = PLANS[id];
          const card = planCards.find((c) => c.planId === id)!;
          const isCurrent = id === current;
          return (
            <li
              key={id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-paper p-5",
                isCurrent ? "border-ink ring-1 ring-ink" : "border-gray-200",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-lg font-bold">{plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-xs font-semibold">
                    {billingCopy.yourPlan}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{card.tagline}</p>
              <p className="font-heading text-2xl font-extrabold">
                {plan.price
                  ? formatCents(plan.price[interval], "USD").replace(/\.00$/, "")
                  : billingCopy.contact}
                {plan.price && plan.price.monthly > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    {billingCopy.perMonth}
                    {interval === "yearly" ? `, ${billingCopy.billedYearly}` : ""}
                  </span>
                )}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {plan.documentsPerMonth == null
                    ? "Custom"
                    : plan.documentsPerMonth.toLocaleString("en-US")}{" "}
                  documents / month
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {plan.seats == null ? "Custom" : plan.seats} {plan.seats === 1 ? "seat" : "seats"}
                </li>
              </ul>
              <div className="mt-auto pt-2">
                {canManage && !isCurrent && (id === "pro" || id === "business") && (
                  <PillButton
                    size="sm"
                    disabled={pending}
                    onClick={() => go(() => startCheckout({ plan: id, interval }))}
                  >
                    {rank(id) > rank(current)
                      ? billingCopy.upgrade(plan.name)
                      : billingCopy.switchTo(plan.name)}
                  </PillButton>
                )}
                {id === "enterprise" && !isCurrent && (
                  <PillButton href={card.cta.href} variant="outline" size="sm">
                    {billingCopy.contact}
                  </PillButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ManageBillingButton() {
  const [pending, startTransition] = useTransition();
  return (
    <PillButton
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openBillingPortal();
          if (result.ok) window.location.assign(result.data.url);
          else toast.error(result.error);
        })
      }
    >
      {billingCopy.manage}
    </PillButton>
  );
}
