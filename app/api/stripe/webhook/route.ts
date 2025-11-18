export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  logStripeEventOnce,
  updateByCustomerId,
  upsertStripeDetails,
} from "@/lib/db/queries";
import { logError, logInfo } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/client";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const SUBSCRIPTION_ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

const SUBSCRIPTION_FREE_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete",
  "incomplete_expired",
]);

async function cancelOtherActiveSubscriptions({
  stripe,
  customerId,
  keepSubscriptionId,
}: {
  stripe: ReturnType<typeof getStripe>;
  customerId: string;
  keepSubscriptionId: string;
}) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const duplicates = subscriptions.data.filter(
      (subscription) =>
        subscription.id !== keepSubscriptionId &&
        SUBSCRIPTION_ACTIVE_STATUSES.has(subscription.status)
    );

    await Promise.all(
      duplicates.map((subscription) =>
        stripe.subscriptions
          .update(subscription.id, { cancel_at_period_end: true })
          .catch((error) => {
            logError("stripe:webhook", "Failed to cancel duplicate subscription", {
              subscriptionId: subscription.id,
              customerId,
              error,
            });
          })
      )
    );
  } catch (error) {
    logError("stripe:webhook", "Stripe subscription dedupe failed", {
      customerId,
      keepSubscriptionId,
      error,
    });
  }
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const items = subscription.items?.data ?? [];

  let latestPeriodEnd: number | null = null;

  for (const item of items) {
    const periodEnd = Number(item.current_period_end);
    if (!Number.isFinite(periodEnd)) {
      continue;
    }
    latestPeriodEnd =
      latestPeriodEnd === null
        ? periodEnd
        : Math.max(latestPeriodEnd, periodEnd);
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
    logError("stripe:webhook", "Stripe webhook signature verification failed", {
      error,
    });
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  const isFirstDelivery = await logStripeEventOnce(event.id);

  if (!isFirstDelivery) {
    logInfo("stripe:webhook", "Stripe webhook replay ignored", {
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json({ received: true });
  }

  logInfo("stripe:webhook", "Stripe webhook received", {
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

        if (customerId && subscriptionId) {
          await cancelOtherActiveSubscriptions({
            stripe,
            customerId,
            keepSubscriptionId: subscriptionId,
          });
        }

        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionCustomer = subscription.customer;
        const customerId =
          typeof subscriptionCustomer === "string"
            ? subscriptionCustomer
            : subscriptionCustomer.id;
        const userId = subscription.metadata?.userId as string | undefined;
        const proExpiresAt = getSubscriptionPeriodEnd(subscription);
        const shouldUpgrade = SUBSCRIPTION_ACTIVE_STATUSES.has(
          subscription.status
        );

        if (shouldUpgrade) {
          await cancelOtherActiveSubscriptions({
            stripe,
            customerId,
            keepSubscriptionId: subscription.id,
          });
        }

        if (userId) {
          await upsertStripeDetails(userId, {
            tier: shouldUpgrade ? "pro" : undefined,
            stripeCustomerId: customerId,
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
          logInfo("stripe:webhook", "Stripe subscription downgraded", {
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
          logInfo("stripe:webhook", "Stripe subscription status update", {
            eventId: event.id,
            subscriptionId: subscription.id,
            status: subscription.status,
          });

          if (userId) {
            await upsertStripeDetails(userId, {
              tier: shouldUpgrade ? "pro" : undefined,
              stripeCustomerId: customerId,
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

          if (shouldUpgrade) {
            await cancelOtherActiveSubscriptions({
              stripe,
              customerId,
              keepSubscriptionId: subscription.id,
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

        logInfo("stripe:webhook", "Stripe subscription deleted; user downgraded", {
          eventId: event.id,
          subscriptionId: subscription.id,
        });

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed":
        logInfo("stripe:webhook", "Stripe invoice event received", {
          eventType: event.type,
          eventId: event.id,
        });
        break;

      default:
        logInfo("stripe:webhook", "Unhandled Stripe event type received", {
          eventType: event.type,
          eventId: event.id,
        });
        break;
    }
  } catch (error: any) {
    logError("stripe:webhook", "Stripe webhook processing error", {
      eventType: event.type,
      eventId: event.id,
      error,
    });
    return NextResponse.json(
      { error: "Failed to process Stripe webhook event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
