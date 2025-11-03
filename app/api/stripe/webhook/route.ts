export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  logStripeEventOnce,
  updateByCustomerId,
  upsertStripeDetails,
} from "@/lib/db/queries";
import { getStripe } from "@/lib/stripe/client";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const SUBSCRIPTION_ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

const SUBSCRIPTION_FREE_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const items = subscription.items?.data ?? [];

  let latestPeriodEnd: number | null = null;

  for (const item of items) {
    const periodEnd = Number(item.current_period_end);
    if (!Number.isFinite(periodEnd)) {
      continue;
    }
    latestPeriodEnd =
      latestPeriodEnd === null ? periodEnd : Math.max(latestPeriodEnd, periodEnd);
  }

  return latestPeriodEnd ? new Date(latestPeriodEnd * 1000) : null;
}

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
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
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
    console.info("Stripe webhook replay ignored", {
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json({ received: true });
  }

  console.info("Stripe webhook received", {
    eventType: event.type,
    eventId: event.id,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const sessionCustomer = session.customer;
        const customerId =
          typeof sessionCustomer === "string"
            ? sessionCustomer
            : (sessionCustomer?.id ?? null);

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.toString() ?? null);

        const userId = session.metadata?.userId as string | undefined;

        let proExpiresAt: Date | null = null;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          proExpiresAt = getSubscriptionPeriodEnd(subscription);
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
        const userId = subscription.metadata?.userId as string | undefined;

        const proExpiresAt = getSubscriptionPeriodEnd(subscription);

        const isImmediateCancellation =
          subscription.status === "canceled" &&
          !subscription.cancel_at_period_end;

        const isDowngraded =
          isImmediateCancellation ||
          SUBSCRIPTION_FREE_STATUSES.has(subscription.status);

        const shouldUpgrade = SUBSCRIPTION_ACTIVE_STATUSES.has(
          subscription.status
        );

        if (isDowngraded) {
          console.info("Stripe subscription downgraded", {
            eventId: event.id,
            subscriptionId: subscription.id,
            status: subscription.status,
          });

          if (userId) {
            await upsertStripeDetails(userId, {
              tier: "free",
              stripeSubscriptionId: null,
              proExpiresAt: null,
            });
          } else {
            await updateByCustomerId(customerId, {
              tier: "free",
              stripeSubscriptionId: null,
              proExpiresAt: null,
            });
          }
        } else {
          console.info("Stripe subscription status update", {
            eventId: event.id,
            subscriptionId: subscription.id,
            status: subscription.status,
          });

          if (userId) {
            await upsertStripeDetails(userId, {
              tier: shouldUpgrade ? "pro" : undefined,
              stripeSubscriptionId: subscription.id,
              proExpiresAt,
            });
          } else {
            await updateByCustomerId(customerId, {
              tier: shouldUpgrade ? "pro" : undefined,
              stripeSubscriptionId: subscription.id,
              proExpiresAt,
            });
          }
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
        const userId = subscription.metadata?.userId as string | undefined;

        if (userId) {
          await upsertStripeDetails(userId, {
            tier: "free",
            stripeSubscriptionId: null,
            proExpiresAt: null,
          });
        } else {
          await updateByCustomerId(customerId, {
            tier: "free",
            stripeSubscriptionId: null,
            proExpiresAt: null,
          });
        }

        console.info("Stripe subscription deleted; user downgraded", {
          eventId: event.id,
          subscriptionId: subscription.id,
        });

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed":
        console.info("Stripe invoice event received", {
          eventType: event.type,
          eventId: event.id,
        });
        break;

      default:
        console.debug("Unhandled Stripe event type received", {
          eventType: event.type,
          eventId: event.id,
        });
        break;
    }
  } catch (error: any) {
    console.error("Stripe webhook processing error", error, {
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json(
      { error: "Failed to process Stripe webhook event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
