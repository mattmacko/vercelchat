"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { openBillingPortal } from "@/lib/billing/client";

export default function Page() {
  const searchParams = useSearchParams();
  const fromPortal = searchParams?.get("fromPortal") === "1";

  useEffect(() => {
    if (fromPortal) {
      return;
    }

    openBillingPortal().catch((error) => {
      console.error("Failed to open billing portal", error);
    });
  }, [fromPortal]);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      {fromPortal ? (
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="font-semibold text-xl">
            You&apos;re back from billing
          </h1>
          <p className="text-muted-foreground text-sm">
            If you still need to manage your subscription, you can reopen the
            billing portal.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button className="w-full" onClick={() => openBillingPortal()}>
              Open billing portal
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/">Back to chat</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground text-sm">
          Opening billing portal…
        </div>
      )}
    </div>
  );
}
