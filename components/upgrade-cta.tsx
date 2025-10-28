"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useBillingLimits } from "@/hooks/use-billing";
import { openBillingPortal, redirectToCheckout } from "@/lib/billing/client";

export function UpgradeCta({
  className,
}: {
  className?: string;
}) {
  const { data, isLoading } = useBillingLimits();

  const remainingLabel = useMemo(() => {
    if (!data || data.limit === null || data.remaining === null) {
      return null;
    }

    return `${data.remaining} message${data.remaining === 1 ? "" : "s"} left`;
  }, [data]);

  if (isLoading) {
    return (
      <Button
        className={cn("hidden h-8 md:flex md:h-fit md:px-3", className)}
        disabled
        variant="outline"
      >
        Loading…
      </Button>
    );
  }

  if (!data) {
    return null;
  }

  if (data.isPro) {
    return (
      <div className={cn("hidden items-center gap-2 md:flex", className)}>
        <Badge variant="secondary">Pro</Badge>
        <Button
          className="h-8 md:h-fit md:px-3"
          onClick={() => {
            void openBillingPortal();
          }}
          size="sm"
          variant="outline"
        >
          Manage billing
        </Button>
      </div>
    );
  }

  return (
    <Button
      className={cn(
        "hidden h-8 justify-between gap-2 md:flex md:h-fit md:px-3",
        className
      )}
      onClick={() => {
        void redirectToCheckout();
      }}
    >
      Upgrade to Pro
      {remainingLabel && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
          {remainingLabel}
        </span>
      )}
    </Button>
  );
}
