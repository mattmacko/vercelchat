export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  logStripeEventOnce,
  upsertStripeDetails,
  updateByCustomerId,
} from "@/lib/db/queries";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (error: any) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  const isFirstDelivery = await logStripeEventOnce(event.id);

  if (!isFirstDelivery) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const sessionCustomer = session.customer;
        const customerId =
          typeof sessionCustomer === "string"
            ? sessionCustomer
            : sessionCustomer?.id ?? null;

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.toString() ?? null;

        const userId = session.metadata?.userId as string | undefined;

        let proExpiresAt: Date | null = null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          proExpiresAt = new Date(subscription.current_period_end * 1000);
        }

        if (userId) {
          await upsertStripeDetails(userId, {
            tier: "pro",
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            proExpiresAt,
          });
        } else if (customerId) {
          await updateByCustomerId(customerId, {
            tier: "pro",
            stripeSubscriptionId: subscriptionId ?? undefined,
            proExpiresAt,
          });
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionCustomer = subscription.customer;
        const customerId =
          typeof subscriptionCustomer === "string"
            ? subscriptionCustomer
            : subscriptionCustomer.id;

        const proExpiresAt = new Date(subscription.current_period_end * 1000);

        if (subscription.status === "canceled" && !subscription.cancel_at_period_end) {
          await updateByCustomerId(customerId, {
            tier: "free",
            stripeSubscriptionId: null,
            proExpiresAt: null,
          });
        } else {
          await updateByCustomerId(customerId, {
            tier: "pro",
            stripeSubscriptionId: subscription.id,
            proExpiresAt,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionCustomer = subscription.customer;
        const customerId =
          typeof subscriptionCustomer === "string"
            ? subscriptionCustomer
            : subscriptionCustomer.id;

        await updateByCustomerId(customerId, {
          tier: "free",
          stripeSubscriptionId: null,
          proExpiresAt: null,
        });

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed":
        // Optional: add logging or alerting here
        break;

      default:
        break;
    }
  } catch (error: any) {
    console.error("Stripe webhook processing error", error);
    return NextResponse.json(
      { error: "Failed to process Stripe webhook event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
