import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth-server";
import { prisma } from "@/lib/db";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.workspaceId?.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
  });
  const customerId = workspace?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account. Subscribe to Pro first." },
      { status: 400 },
    );
  }
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/billing`,
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
