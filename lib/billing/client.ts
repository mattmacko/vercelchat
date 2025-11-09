"use client";

import { toast } from "@/components/toast";

async function postAndExtractUrl(endpoint: string) {
  const response = await fetch(endpoint, { method: "POST" });

  if (!response.ok) {
    let message = "Unable to complete request. Please try again.";

    try {
      const body = await response.json();
      if (typeof body?.message === "string") {
        message = body.message;
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

export async function redirectToCheckout() {
  try {
    const url = await postAndExtractUrl("/api/billing/checkout");
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
