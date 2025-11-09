"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { toast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBillingLimits } from "@/hooks/use-billing";
import { openBillingPortal } from "@/lib/billing/client";
import { guestRegex } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function UpgradeCta({ className }: { className?: string }) {
  const { data, isLoading } = useBillingLimits();
  const { data: session, status } = useSession();
  const router = useRouter();

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
        "hidden h-8 justify-between gap-2 md:flex md:h-fit md:px-3",
        className
      )}
      onClick={() => {
        if (status === "loading") {
          toast({
            type: "error",
            description: "Checking authentication status, please try again!",
          });
          return;
        }

        const isGuest = guestRegex.test(session?.user?.email ?? "");

        if (isGuest) {
          router.push("/register?next=/billing/upgrade");
          return;
        }

        // Non-guest users go to upgrade route which handles portal vs checkout
        router.push("/billing/upgrade");
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
