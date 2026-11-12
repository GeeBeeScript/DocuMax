import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { ToneBadge } from "@/components/app/status-badge";
import { UsageMeter } from "@/components/app/usage-meter";
import { billingCopy } from "@/content/app";
import { ManageBillingButton, PlanPicker } from "@/features/billing/components/plan-picker";
import { getBillingState } from "@/features/billing/queries";
import { hasRole } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { PLANS } from "@/lib/billing/plans";
import { monthPeriod, shiftMonth } from "@/lib/calc/period";

export const metadata: Metadata = { title: billingCopy.title };

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireActiveOrg();
  const [state, params] = await Promise.all([getBillingState(ctx.org.id), searchParams]);
  const owner = hasRole(ctx.role, ["owner"]);
  const { usage } = state;
  const plan = PLANS[usage.plan];
  const resets = shiftMonth(monthPeriod(usage.periodStart), 1).start;
  const periodEnd = state.currentPeriodEnd ? dateFormat.format(new Date(state.currentPeriodEnd)) : null;
  const statusLabel = billingCopy.status[state.status] ?? state.status;

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={ctx.org.id} tables={["subscriptions"]} active={params.checkout === "success"} />
      <PageHeader
        title={billingCopy.title}
        description={billingCopy.description}
        actions={owner && state.hasCustomer && <ManageBillingButton />}
      />
      {params.checkout === "success" && <FormAlert tone="success">{billingCopy.checkoutSuccess}</FormAlert>}
      {state.paymentFailed && <FormAlert tone="danger">{billingCopy.paymentFailed}</FormAlert>}
      {!owner && <FormAlert tone="info">{billingCopy.ownersOnly}</FormAlert>}

      <section
        aria-labelledby="current-plan"
        className="grid gap-4 rounded-2xl border border-gray-200 bg-paper p-6 md:grid-cols-3"
      >
        <div className="flex flex-col gap-1">
          <h2 id="current-plan" className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {billingCopy.current}
          </h2>
          <p className="flex items-center gap-2 font-heading text-2xl font-extrabold">
            {plan.name}
            {statusLabel && usage.plan !== "free" && (
              <ToneBadge tone={state.status === "past_due" ? "danger" : "success"} label={statusLabel} />
            )}
          </p>
          {periodEnd && usage.plan !== "free" && (
            <p className="text-sm text-muted-foreground">
              {state.cancelAtPeriodEnd ? billingCopy.ends(periodEnd) : billingCopy.renews(periodEnd)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{billingCopy.usage.documents}</p>
          <UsageMeter
            used={usage.documentsUsed}
            cap={usage.documentsCap}
            label={billingCopy.usage.meterLabel(usage.documentsUsed, usage.documentsCap)}
            caption={`${billingCopy.usage.of(usage.documentsUsed, usage.documentsCap)} · ${billingCopy.usage.resets(dateFormat.format(new Date(`${resets}T00:00:00Z`)))}`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{billingCopy.usage.seats}</p>
          <UsageMeter
            used={usage.seatsUsed}
            cap={usage.seatsCap}
            label={`${usage.seatsUsed} seats used`}
            caption={billingCopy.usage.of(usage.seatsUsed, usage.seatsCap)}
          />
        </div>
      </section>

      <PlanPicker current={usage.plan} canManage={owner} />
    </div>
  );
}
