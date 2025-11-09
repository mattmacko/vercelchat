"use client";

import { useEffect } from "react";

import { redirectToCheckout } from "@/lib/billing/client";

export default function Page() {
  useEffect(() => {
    redirectToCheckout().catch((error) => {
      console.error("Failed to start checkout", error);
    });
  }, []);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="text-center text-muted-foreground text-sm">
        Preparing your upgrade…
      </div>
    </div>
  );
}
