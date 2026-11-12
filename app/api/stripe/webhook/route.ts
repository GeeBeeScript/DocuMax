import { applyStripeEvent } from "@/lib/billing/sync";
import { webhooks } from "@/lib/billing/stripe";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook. Verifies the signature on the raw body (STRIPE_WEBHOOK_SECRET), then applies the event with the
 * service-role client (lib/billing/sync.ts — idempotent). 400 for a bad signature; 500 makes Stripe retry.
 */
export async function POST(request: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Billing isn't configured.", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400 });

  const body = await request.text();
  let event;
  try {
    event = await webhooks().constructEventAsync(body, signature, secret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }
  try {
    await applyStripeEvent(createSupabaseAdminClient(), event);
  } catch (error) {
    console.error("stripe webhook failed", {
      type: event.type,
      id: event.id,
      error: (error as Error).message,
    });
    return new Response("Error applying the event.", { status: 500 });
  }
  return Response.json({ received: true });
}
