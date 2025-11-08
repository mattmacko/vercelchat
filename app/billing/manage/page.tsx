"use client";

import { useEffect } from "react";

import { openBillingPortal } from "@/lib/billing/client";

export default function Page() {
  useEffect(() => {
    void openBillingPortal();
  }, []);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="text-center text-sm text-muted-foreground">
        Opening billing portal…
      </div>
    </div>
  );
}

