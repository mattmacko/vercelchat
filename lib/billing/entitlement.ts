import type Stripe from "stripe";

export function isProEntitledSubscriptionStatus(
  status: Stripe.Subscription.Status | null | undefined
) {
  return status === "active" || status === "trialing";
}

export function shouldDedupeSubscriptionsOnStatus(
  status: Stripe.Subscription.Status | null | undefined
) {
  return status === "active";
}
