"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBillingLimits } from "@/hooks/use-billing";
import { redirectToCheckout } from "@/lib/billing/client";
import { LIFETIME_PLAN, PRO_PLAN } from "@/lib/billing/config";
import { guestRegex } from "@/lib/constants";

export function UpgradeOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, mutate } = useBillingLimits();
  const numericLimit = typeof data?.limit === "number" ? data.limit : null;
  const { data: session, status } = useSession();
  const router = useRouter();

  const startCheckout = (plan: "monthly" | "lifetime") => {
    if (status === "loading") {
      toast({
        type: "error",
        description: "Checking authentication status, please try again!",
      });
      return;
    }

    const isGuest = guestRegex.test(session?.user?.email ?? "");

    if (isGuest) {
      router.push(`/register?next=/billing/upgrade?plan=${plan}`);
      return;
    }

    void redirectToCheckout(plan);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    mutate().catch((error) => {
      console.error("Failed to refresh billing limits", error);
    });
  }, [mutate, open]);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="max-w-md space-y-4">
        <AlertDialogHeader className="space-y-3 text-left">
          <AlertDialogTitle className="text-2xl">
            Unlock {PRO_PLAN.name}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="text-muted-foreground">
              You&apos;ve used all available messages on the free plan.
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{LIFETIME_PLAN.name} access</span>
                <Badge variant="secondary">Best value</Badge>
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-semibold text-3xl">
                {LIFETIME_PLAN.price}
                <span className="font-normal text-muted-foreground text-sm">
                  {LIFETIME_PLAN.interval}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {LIFETIME_PLAN.description}
              </p>
            </div>
            <div className="flex items-baseline gap-2 font-semibold text-xl">
              {PRO_PLAN.price}
              <span className="font-normal text-muted-foreground text-sm">
                per {PRO_PLAN.interval}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{PRO_PLAN.description}</p>
            <ul className="list-disc pl-5 text-sm">
              {PRO_PLAN.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {numericLimit !== null && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                Free plan limit: {numericLimit} lifetime messages
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-0 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="w-full sm:w-auto">
            Maybe later
          </AlertDialogCancel>
          <Button
            className="w-full sm:w-auto"
            onClick={() => startCheckout("monthly")}
            variant="outline"
          >
            Pay monthly
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => startCheckout("lifetime")}
          >
            Get lifetime access
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
