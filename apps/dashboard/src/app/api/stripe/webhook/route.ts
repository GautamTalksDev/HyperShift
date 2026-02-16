import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const orchestratorUrl =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";
const tierUpdateSecret = process.env.WORKSPACE_TIER_UPDATE_SECRET ?? "";

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const workspaceId = (
    event.data.object as { metadata?: { workspace_id?: string } }
  ).metadata?.workspace_id;
  if (!workspaceId) {
    if (
      event.type === "checkout.session.completed" ||
      event.type.startsWith("customer.subscription")
    ) {
      const obj = event.data.object as {
        subscription?: string;
        customer?: string;
        id?: string;
      };
      const subId = obj.subscription ?? obj.id;
      const custId =
        typeof obj.customer === "string" ? obj.customer : undefined;
      const sub =
        subId && stripe
          ? await stripe.subscriptions.retrieve(subId).catch(() => null)
          : null;
      const wid = sub?.metadata?.workspace_id;
      if (wid) {
        await setTier(wid, "pro");
        if (custId)
          await supabase
            .from("workspaces")
            .update({
              stripe_customer_id: custId,
              stripe_subscription_id: subId,
            })
            .eq("id", wid);
      }
    }
    return NextResponse.json({ received: true });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await setTier(workspaceId, "pro");
    if (session.customer) {
      await supabase
        .from("workspaces")
        .update({
          stripe_customer_id:
            typeof session.customer === "string"
              ? session.customer
              : session.customer.id,
          stripe_subscription_id: session.subscription
            ? String(session.subscription)
            : null,
        })
        .eq("id", workspaceId);
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const wid = sub.metadata?.workspace_id ?? workspaceId;
    const tier = sub.status === "active" ? "pro" : "free";
    await setTier(wid, tier);
    if (event.type === "customer.subscription.deleted") {
      await supabase
        .from("workspaces")
        .update({ stripe_subscription_id: null })
        .eq("id", wid);
    }
  }
  return NextResponse.json({ received: true });
}

async function setTier(workspaceId: string, tier: "free" | "pro") {
  const res = await fetch(
    `${orchestratorUrl}/workspaces/${encodeURIComponent(workspaceId)}/tier`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(tierUpdateSecret ? { "X-Webhook-Secret": tierUpdateSecret } : {}),
      },
      body: JSON.stringify({ tier }),
    },
  );
  if (!res.ok) {
    console.error(
      "[stripe webhook] setTier failed:",
      workspaceId,
      await res.text(),
    );
  }
}
