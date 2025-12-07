"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useBillingLimits } from "@/hooks/use-billing";

type VerifyState = "verifying" | "success" | "error";

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  const { mutate } = useBillingLimits();
  const [verifyState, setVerifyState] = useState<VerifyState>(
    sessionId ? "verifying" : "success"
  );

  useEffect(() => {
    if (!sessionId) {
      // No session_id means we're relying on webhook (legacy flow)
      mutate().catch((error) => {
        console.error("Failed to refresh billing limits", error);
      });
      return;
    }

    // Verify the checkout session with Stripe directly
    const verifyCheckout = async () => {
      try {
        const response = await fetch(
          `/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await response.json();

        if (response.ok && data.verified) {
          setVerifyState("success");
          // Refresh billing limits to update UI
          await mutate();
        } else if (response.ok && !data.verified) {
          // Payment not yet complete, retry after a short delay
          setTimeout(verifyCheckout, 2000);
        } else {
          console.error("Verification failed:", data.error);
          setVerifyState("error");
        }
      } catch (error) {
        console.error("Failed to verify checkout session", error);
        setVerifyState("error");
      }
    };

    verifyCheckout();
  }, [sessionId, mutate]);

  if (verifyState === "verifying") {
    return (
      <div className="flex min-h-dvh w-screen items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h1 className="font-semibold text-xl">Verifying payment...</h1>
          <p className="text-muted-foreground text-sm">
            Please wait while we confirm your upgrade.
          </p>
        </div>
      </div>
    );
  }

  if (verifyState === "error") {
    return (
      <div className="flex min-h-dvh w-screen items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="font-semibold text-2xl">Something went wrong</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t verify your payment. If you were charged, your
            upgrade will be applied shortly. Please contact support if the issue
            persists.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Link
              className="w-full rounded-md border border-input px-4 py-2 font-medium text-sm hover:bg-muted"
              href="/"
            >
              Go back to Chat
            </Link>
            <Link
              className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
              href="/billing/manage"
            >
              Check billing status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-semibold text-2xl">You&apos;re all set 🎉</h1>
        <p className="text-muted-foreground">
          Your upgrade was successful. Head back to the app or open the billing
          portal to review your subscription details.
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Link
            className="w-full rounded-md border border-input px-4 py-2 font-medium text-sm hover:bg-muted"
            href="/"
          >
            Go back to Chat
          </Link>
          <Link
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
            href="/billing/manage"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-screen items-center justify-center p-6">
          <div className="text-center text-muted-foreground text-sm">
            Loading...
          </div>
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}
