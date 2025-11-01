export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserById, setStripeCustomerId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";

async function resolvePriceId(stripe: ReturnType<typeof getStripe>) {
  const lookupKey = process.env.STRIPE_PRICE_LOOKUP_KEY_PRO;

  if (lookupKey) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });

    if (!prices.data[0]) {
      throw new Error(`No Stripe price found for lookup key ${lookupKey}`);
    }

    return prices.data[0].id;
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_LOOKUP_KEY_PRO or STRIPE_PRICE_ID");
  }

  return priceId;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  if (
    dbUser.tier === "pro" &&
    dbUser.proExpiresAt &&
    dbUser.proExpiresAt > new Date()
  ) {
    return NextResponse.json({ message: "Already on the Pro plan." });
  }

  const stripe = getStripe();

  let customerId = dbUser.stripeCustomerId ?? null;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: session.user.email ?? undefined,
          metadata: { userId: session.user.id },
        },
        { idempotencyKey: `cust:${session.user.id}` }
      );

      customerId = customer.id;
      await setStripeCustomerId(session.user.id, customerId);
    }

    const priceId = await resolvePriceId(stripe);
    const origin = process.env.APP_URL ?? request.nextUrl.origin;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing/cancel`,
        line_items: [{ price: priceId, quantity: 1 }],
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        customer_update: { address: "auto" },
        metadata: { userId: session.user.id },
        subscription_data: {
          metadata: { userId: session.user.id },
        },
      },
      { idempotencyKey: `checkout:${session.user.id}:${Date.now()}` }
    );

    if (!checkoutSession.url) {
      throw new Error("Stripe Checkout session did not return a URL");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Stripe checkout error", error);
    return NextResponse.json(
      { error: "Failed to create Stripe Checkout session" },
      { status: 500 }
    );
  }
}
