export const FREE_LIFETIME_MESSAGE_LIMIT = 3;

export const PRO_PLAN = {
  name: "Pro",
  price: "$30",
  interval: "month",
  description: "Unlock unlimited conversations and priority access.",
  features: [
    "Unlimited AI messages",
    "Priority response speeds",
    "Early access to new features",
  ],
};

export const LIFETIME_PLAN = {
  name: "Lifetime",
  price: "$197",
  interval: "one-time",
  description: "Pay once. Own it forever.",
  features: PRO_PLAN.features,
  valueNote: "Pays for itself in ~7 months",
  spotsRemaining: 26,
};

export type BillingLimitsResponse = {
  isPro: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  checkoutUrl: string;
  portalUrl: string;
  proExpiresAt: string | null;
};
