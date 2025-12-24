"use client";

import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-semibold text-2xl">Checkout canceled</h1>
        <p className="text-muted-foreground">
          No charges were made. You can restart the upgrade flow at any time.
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
            href="/billing/upgrade"
          >
            Try upgrade again
          </Link>
        </div>
      </div>
    </div>
  );
}
