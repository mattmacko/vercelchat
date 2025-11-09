"use client";

import { useEffect } from "react";

import { openBillingPortal } from "@/lib/billing/client";

export default function Page() {
  useEffect(() => {
    openBillingPortal().catch((error) => {
      console.error("Failed to open billing portal", error);
    });
  }, []);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="text-center text-muted-foreground text-sm">
        Opening billing portal…
      </div>
    </div>
  );
}
