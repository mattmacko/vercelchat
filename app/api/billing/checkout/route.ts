export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/app/(auth)/auth";
import { getUserById, setStripeCustomerId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

const HTTP_URL_REGEX = /^https?:\/\//;

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

async function findActiveSubscription(
  stripe: ReturnType<typeof getStripe>,
  identifiers: {
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  }
) {
  if (identifiers.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        identifiers.stripeSubscriptionId
      );

      if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        return subscription;
      }
    } catch (error: any) {
      if (error?.code !== "resource_missing") {
        console.error("Stripe subscription lookup failed", error, {
          stripeSubscriptionId: identifiers.stripeSubscriptionId,
        });
      }
    }
  }

  if (!identifiers.stripeCustomerId) {
    return null;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: identifiers.stripeCustomerId,
      status: "all",
      limit: 10,
    });

    return (
      subscriptions.data.find((sub) =>
        ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status)
      ) ?? null
    );
  } catch (error) {
    console.error("Stripe subscription list failed", error, {
      stripeCustomerId: identifiers.stripeCustomerId,
    });
    return null;
  }
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

  const stripe = getStripe();
  const origin = process.env.APP_URL ?? request.nextUrl.origin;
  const portalPath =
    process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? "/billing/manage";
  const manageUrl = HTTP_URL_REGEX.test(portalPath)
    ? portalPath
    : `${origin}${portalPath.startsWith("/") ? portalPath : `/${portalPath}`}`;

  if (
    dbUser.tier === "pro" &&
    dbUser.proExpiresAt &&
    dbUser.proExpiresAt > new Date()
  ) {
    return NextResponse.json({
      message: "Already on the Pro plan.",
      url: manageUrl,
    });
  }

  const existingSubscription = await findActiveSubscription(stripe, {
    stripeSubscriptionId: dbUser.stripeSubscriptionId,
    stripeCustomerId: dbUser.stripeCustomerId,
  });

  if (existingSubscription) {
    return NextResponse.json({ url: manageUrl });
  }

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
    const headerIdempotencyKey =
      request.headers.get("x-idempotency-key") ??
      request.headers.get("x-stripe-idempotency-key");
    const idempotencyKey =
      headerIdempotencyKey ??
      `checkout:${session.user.id}:${priceId}:${Date.now().toString(36)}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: session.user.id,
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
      { idempotencyKey }
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
