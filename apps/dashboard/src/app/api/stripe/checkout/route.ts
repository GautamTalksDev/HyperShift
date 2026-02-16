import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const priceId = process.env.STRIPE_PRICE_ID_PRO;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function POST() {
  const session = await getSession();
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe || !priceId) {
    return NextResponse.json(
      {
        error:
          "Billing not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO.",
      },
      { status: 503 },
    );
  }
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", session.workspaceId)
    .single();
  const customerId = workspace?.stripe_customer_id ?? undefined;
  const successUrl = `${baseUrl}/billing?success=1`;
  const cancelUrl = `${baseUrl}/billing?cancel=1`;
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId || undefined,
      customer_email: customerId ? undefined : (session.user?.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspace_id: session.workspaceId },
      subscription_data: { metadata: { workspace_id: session.workspaceId } },
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[stripe checkout]", e);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
