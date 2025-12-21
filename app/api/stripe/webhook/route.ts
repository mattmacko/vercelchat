import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getSubscriptionPeriodEnd,
  isProEntitledSubscription,
  shouldDedupeSubscriptionsOnStatus,
} from "@/lib/billing/entitlement";
import {
  claimStripeEvent,
  markStripeEventFailed,
  markStripeEventProcessed,
  updateByCustomerId,
  upsertStripeDetails,
} from "@/lib/db/queries";
import { logError, logInfo } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const SUBSCRIPTION_DEDUPE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
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
        SUBSCRIPTION_DEDUPE_STATUSES.has(subscription.status)
    );

    await Promise.all(
      duplicates.map((subscription) =>
        stripe.subscriptions
          .cancel(subscription.id)
          .then(() => {
            logInfo(
              "stripe:webhook",
              "Canceled duplicate subscription immediately",
              {
                subscriptionId: subscription.id,
                customerId,
              }
            );
          })
          .catch((error) => {
            logError(
              "stripe:webhook",
              "Failed to cancel duplicate subscription",
              {
                subscriptionId: subscription.id,
                customerId,
                error,
              }
            );
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

function pickPreferredEntitledSubscription(
  subscriptions: Stripe.Subscription[]
) {
  if (subscriptions.length === 0) {
    return null;
  }

  const active = subscriptions.filter(
    (subscription) => subscription.status === "active"
  );
  const candidates = active.length > 0 ? active : subscriptions;

  return candidates.reduce((best, current) => {
    const bestEnd = getSubscriptionPeriodEnd(best)?.getTime() ?? 0;
    const currentEnd = getSubscriptionPeriodEnd(current)?.getTime() ?? 0;
    return currentEnd > bestEnd ? current : best;
  });
}

async function syncCustomerEntitlement({
  stripe,
  customerId,
  userId,
  eventId,
}: {
  stripe: ReturnType<typeof getStripe>;
  customerId: string;
  userId?: string;
  eventId: string;
}): Promise<{ entitled: boolean; subscription: Stripe.Subscription | null }> {
  const now = new Date();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const entitled = subscriptions.data.filter((subscription) =>
    isProEntitledSubscription(subscription, now)
  );
  const preferred = pickPreferredEntitledSubscription(entitled);

  if (!preferred) {
    if (userId) {
      await upsertStripeDetails(userId, {
        tier: "free",
        stripeCustomerId: customerId,
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

    logInfo("stripe:webhook", "Customer entitlement sync downgraded user", {
      eventId,
      customerId,
      hasUserId: Boolean(userId),
    });

    return { entitled: false, subscription: null };
  }

  const proExpiresAt = getSubscriptionPeriodEnd(preferred);

  if (userId) {
    await upsertStripeDetails(userId, {
      tier: "pro",
      stripeCustomerId: customerId,
      stripeSubscriptionId: preferred.id,
      proExpiresAt,
    });
  } else {
    await updateByCustomerId(customerId, {
      tier: "pro",
      stripeSubscriptionId: preferred.id,
      proExpiresAt,
    });
  }

  logInfo("stripe:webhook", "Customer entitlement sync upgraded user", {
    eventId,
    customerId,
    hasUserId: Boolean(userId),
    subscriptionId: preferred.id,
    status: preferred.status,
  });

  if (shouldDedupeSubscriptionsOnStatus(preferred.status)) {
    await cancelOtherActiveSubscriptions({
      stripe,
      customerId,
      keepSubscriptionId: preferred.id,
    });
  }

  return { entitled: true, subscription: preferred };
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

  let shouldProcessEvent = false;

  try {
    const claimResult = await claimStripeEvent(event.id);
    shouldProcessEvent = claimResult.shouldProcess;
  } catch (error) {
    logError("stripe:webhook", "Failed to claim Stripe webhook event", {
      eventType: event.type,
      eventId: event.id,
      error,
    });
    return NextResponse.json(
      { error: "Failed to persist webhook delivery state" },
      { status: 500 }
    );
  }

  if (!shouldProcessEvent) {
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
        let isEntitled = false;
        let shouldDedupe = false;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          proExpiresAt = getSubscriptionPeriodEnd(subscription);
          isEntitled = isProEntitledSubscription(subscription);
          shouldDedupe = shouldDedupeSubscriptionsOnStatus(subscription.status);
        }

        if (userId) {
          await upsertStripeDetails(userId, {
            tier: isEntitled ? "pro" : undefined,
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: isEntitled
              ? (subscriptionId ?? undefined)
              : undefined,
            proExpiresAt: isEntitled ? proExpiresAt : undefined,
          });
        } else if (customerId) {
          await updateByCustomerId(customerId, {
            tier: isEntitled ? "pro" : undefined,
            stripeSubscriptionId: isEntitled
              ? (subscriptionId ?? undefined)
              : undefined,
            proExpiresAt: isEntitled ? proExpiresAt : undefined,
          });
        }

        if (customerId && subscriptionId && shouldDedupe) {
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
        const isEntitled = isProEntitledSubscription(subscription);
        const shouldDedupe = shouldDedupeSubscriptionsOnStatus(
          subscription.status
        );

        if (shouldDedupe) {
          await cancelOtherActiveSubscriptions({
            stripe,
            customerId,
            keepSubscriptionId: subscription.id,
          });
        }

        if (userId) {
          await upsertStripeDetails(userId, {
            tier: isEntitled ? "pro" : undefined,
            stripeCustomerId: customerId,
            stripeSubscriptionId: isEntitled ? subscription.id : undefined,
            proExpiresAt: isEntitled ? proExpiresAt : undefined,
          });
        } else {
          await updateByCustomerId(customerId, {
            tier: isEntitled ? "pro" : undefined,
            stripeSubscriptionId: isEntitled ? subscription.id : undefined,
            proExpiresAt: isEntitled ? proExpiresAt : undefined,
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

        const isEntitled = isProEntitledSubscription(subscription);
        const shouldDedupe = shouldDedupeSubscriptionsOnStatus(
          subscription.status
        );

        if (isEntitled) {
          logInfo("stripe:webhook", "Stripe subscription status update", {
            eventId: event.id,
            subscriptionId: subscription.id,
            status: subscription.status,
          });

          if (userId) {
            await upsertStripeDetails(userId, {
              tier: "pro",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              proExpiresAt,
            });
          } else {
            await updateByCustomerId(customerId, {
              tier: "pro",
              stripeSubscriptionId: subscription.id,
              proExpiresAt,
            });
          }

          if (shouldDedupe) {
            await cancelOtherActiveSubscriptions({
              stripe,
              customerId,
              keepSubscriptionId: subscription.id,
            });
          }
        } else {
          logInfo("stripe:webhook", "Stripe subscription downgraded", {
            eventId: event.id,
            subscriptionId: subscription.id,
            status: subscription.status,
          });

          await syncCustomerEntitlement({
            stripe,
            customerId,
            userId,
            eventId: event.id,
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
        const userId = subscription.metadata?.userId as string | undefined;

        await syncCustomerEntitlement({
          stripe,
          customerId,
          userId,
          eventId: event.id,
        });

        logInfo(
          "stripe:webhook",
          "Stripe subscription deleted; user downgraded",
          {
            eventId: event.id,
            subscriptionId: subscription.id,
          }
        );

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
    try {
      await markStripeEventFailed(event.id, error);
    } catch (markError) {
      logError("stripe:webhook", "Failed to mark Stripe event as failed", {
        eventType: event.type,
        eventId: event.id,
        error: markError,
      });
    }
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

  try {
    await markStripeEventProcessed(event.id);
  } catch (error) {
    logError("stripe:webhook", "Failed to mark Stripe event as processed", {
      eventType: event.type,
      eventId: event.id,
      error,
    });
    return NextResponse.json(
      { error: "Failed to persist webhook delivery state" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
