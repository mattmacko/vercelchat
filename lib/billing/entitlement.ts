import type Stripe from "stripe";

const PRO_GRACE_PERIOD_MS = 2 * 24 * 60 * 60 * 1000;

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
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

export function isProEntitledSubscription(
  subscription: Stripe.Subscription | null | undefined,
  now = new Date()
) {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    return true;
  }

  if (subscription.status === "past_due") {
    const periodEnd = getSubscriptionPeriodEnd(subscription);
    if (!periodEnd) {
      return false;
    }
    return periodEnd.getTime() + PRO_GRACE_PERIOD_MS > now.getTime();
  }

  return false;
}

export function isUserProEntitled(
  user: {
    tier?: string | null;
    stripeSubscriptionId?: string | null;
    proExpiresAt?: Date | null;
    lifetimeAccess?: boolean | null;
  },
  now = new Date()
) {
  if (user?.lifetimeAccess) {
    return true;
  }

  if (user?.tier !== "pro" || !user?.stripeSubscriptionId) {
    return false;
  }

  if (!user.proExpiresAt) {
    return true;
  }

  const graceEndsAt = new Date(
    user.proExpiresAt.getTime() + PRO_GRACE_PERIOD_MS
  );
  return graceEndsAt.getTime() > now.getTime();
}

export function shouldDedupeSubscriptionsOnStatus(
  status: Stripe.Subscription.Status | null | undefined
) {
  return status === "active";
}
