"use client";

import { toast } from "@/components/toast";

export type CheckoutPlan = "monthly" | "lifetime";

async function postAndExtractUrl(
  endpoint: string,
  body?: Record<string, unknown>
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = "Unable to complete request. Please try again.";

    try {
      const payload = await response.json();
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch (_) {
      // ignore JSON parse errors
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (!data?.url || typeof data.url !== "string") {
    throw new Error("No checkout URL returned from server.");
  }

  return data.url;
}

export async function redirectToCheckout(plan: CheckoutPlan = "monthly") {
  try {
    const url = await postAndExtractUrl("/api/billing/checkout", { plan });
    window.location.href = url;
  } catch (error: any) {
    toast({
      type: "error",
      description:
        error?.message ?? "Failed to start checkout. Please try again.",
    });
  }
}

export async function openBillingPortal() {
  try {
    const url = await postAndExtractUrl("/api/billing/portal");
    window.location.href = url;
  } catch (error: any) {
    toast({
      type: "error",
      description:
        error?.message ?? "Failed to open billing portal. Please try again.",
    });
  }
}
