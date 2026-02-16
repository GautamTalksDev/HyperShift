import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function POST() {
  const session = await getSession();
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", session.workspaceId)
    .single();
  const customerId = workspace?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account. Subscribe to Pro first." },
      { status: 400 },
    );
  }
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error("[stripe portal]", e);
    return NextResponse.json(
      { error: "Failed to open customer portal" },
      { status: 500 },
    );
  }
}
