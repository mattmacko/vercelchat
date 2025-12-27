"use client";

import { sendGTMEvent } from "@next/third-parties/google";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useBillingLimits } from "@/hooks/use-billing";

type VerifyState = "verifying" | "success" | "error";

const MAX_VERIFY_ATTEMPTS = 10;
const VERIFY_RETRY_DELAY_MS = 2000;
const TERMINAL_VERIFY_STATUSES = new Set([
  "canceled",
  "expired",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "unpaid",
]);

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  const { mutate } = useBillingLimits();
  const [verifyState, setVerifyState] = useState<VerifyState>(
    sessionId ? "verifying" : "success"
  );
  const verifyAttempts = useRef(0);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purchaseTracked = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      // No session_id means we're relying on webhook (legacy flow)
      mutate().catch((error) => {
        console.error("Failed to refresh billing limits", error);
      });
      return;
    }

    let isActive = true;
    verifyAttempts.current = 0;
    setVerifyState("verifying");

    // Verify the checkout session with Stripe directly
    const verifyCheckout = async () => {
      verifyAttempts.current += 1;

      try {
        const response = await fetch(
          `/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await response.json();

        if (!isActive) {
          return;
        }

        if (response.ok && data.verified) {
          setVerifyState("success");

          if (!purchaseTracked.current && sessionId) {
            purchaseTracked.current = true;

            const amountTotal =
              typeof data?.amountTotal === "number" ? data.amountTotal : null;
            const currency =
              typeof data?.currency === "string"
                ? data.currency.toUpperCase()
                : null;
            const plan = typeof data?.plan === "string" ? data.plan : null;

            const payload: Record<string, unknown> = {
              event: "purchase",
              transaction_id: sessionId,
            };

            if (typeof amountTotal === "number") {
              payload.value = amountTotal / 100;
            }

            if (currency) {
              payload.currency = currency;
            }

            if (plan) {
              payload.plan = plan;
              payload.purchase_type =
                plan === "lifetime" ? "one_time" : "subscription";
            }

            sendGTMEvent(payload);
          }

          // Refresh billing limits to update UI
          await mutate();
        } else if (response.ok && !data.verified) {
          const status = typeof data?.status === "string" ? data.status : null;
          const reachedLimit = verifyAttempts.current >= MAX_VERIFY_ATTEMPTS;
          const shouldStop =
            reachedLimit || (status && TERMINAL_VERIFY_STATUSES.has(status));

          if (shouldStop) {
            setVerifyState("error");
            return;
          }

          // Payment not yet complete, retry after a short delay
          verifyTimeoutRef.current = setTimeout(
            verifyCheckout,
            VERIFY_RETRY_DELAY_MS
          );
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

    return () => {
      isActive = false;
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
      }
    };
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
          portal to review your billing details.
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
