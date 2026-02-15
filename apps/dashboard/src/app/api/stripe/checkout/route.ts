import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth-server";
import { prisma } from "@/lib/db";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const priceId = process.env.STRIPE_PRICE_ID_PRO;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.workspaceId?.length) {
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
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
  });
  const customerId = workspace?.stripeCustomerId ?? undefined;
  const successUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/billing?success=1`;
  const cancelUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/billing?cancel=1`;
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId || undefined,
      customer_email: customerId
        ? undefined
        : (session.user?.email ?? undefined),
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
