"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useBillingLimits } from "@/hooks/use-billing";

export default function BillingSuccessPage() {
  const { mutate } = useBillingLimits();

  useEffect(() => {
    mutate().catch((error) => {
      console.error("Failed to refresh billing limits after checkout", error);
    });
  }, [mutate]);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">You&apos;re all set 🎉</h1>
        <p className="text-muted-foreground">
          Your upgrade was successful. Head back to the app or open the billing
          portal to review your subscription details.
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Link
            className="w-full rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            href="/"
          >
            Go back to Chat
          </Link>
          <Link
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href="/billing/manage"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </div>
  );
}
