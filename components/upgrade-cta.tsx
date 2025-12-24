"use client";

import { useMemo } from "react";
import { toast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBillingLimits } from "@/hooks/use-billing";
import { openBillingPortal } from "@/lib/billing/client";
import { cn } from "@/lib/utils";

export function UpgradeCta({
  className,
  onUpgrade,
}: {
  className?: string;
  onUpgrade?: () => void;
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
        className={cn("flex h-8 text-xs md:text-sm md:h-fit md:px-3", className)}
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
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="secondary" className="text-[10px] md:text-xs">Pro</Badge>
        <Button
          className="h-8 px-2 text-xs md:h-fit md:px-3 md:text-sm"
          onClick={() => {
            openBillingPortal().catch((error) => {
              console.error("Failed to open billing portal", error);
              toast({
                type: "error",
                description: "Unable to open billing portal. Try again soon.",
              });
            });
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
        "flex h-8 justify-between gap-2 text-xs md:h-fit md:px-3 md:text-sm",
        className
      )}
      onClick={() => {
        if (onUpgrade) {
          onUpgrade();
          return;
        }

        // Fallback path for non-chat contexts.
        window.location.href = "/billing/upgrade";
      }}
    >
      <span className="md:hidden">Upgrade</span>
      <span className="hidden md:inline">Upgrade to Pro</span>
      {remainingLabel && (
        <span
          className={cn(
            "rounded-full bg-primary/10 px-2 py-0.5 text-[10px] md:text-xs",
            data.remaining !== null && data.remaining <= 3 && "animate-pulse"
          )}
        >
          {remainingLabel}
        </span>
      )}
    </Button>
  );
}
