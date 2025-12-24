export const FREE_LIFETIME_MESSAGE_LIMIT = 5;

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
  description: "One-time payment for unlimited access forever.",
  features: PRO_PLAN.features,
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
