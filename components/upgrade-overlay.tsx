"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBillingLimits } from "@/hooks/use-billing";
import { PRO_PLAN } from "@/lib/billing/config";
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
            Upgrade to {PRO_PLAN.name}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="text-muted-foreground">
              You&apos;ve used all available messages on the free plan.
            </div>
            <div className="flex items-baseline gap-2 font-semibold text-3xl">
              {PRO_PLAN.price}
              <span className="font-normal text-muted-foreground text-sm">
                per {PRO_PLAN.interval}
              </span>
            </div>
            <p>{PRO_PLAN.description}</p>
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

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="w-full sm:w-auto">
            Maybe later
          </AlertDialogCancel>
          <AlertDialogAction
            className="w-full sm:w-auto"
            onClick={() => {
              if (status === "loading") {
                toast({
                  type: "error",
                  description:
                    "Checking authentication status, please try again!",
                });
                return;
              }

              const isGuest = guestRegex.test(session?.user?.email ?? "");

              if (isGuest) {
                router.push("/register?next=/billing/upgrade");
                return;
              }

              router.push("/billing/upgrade");
            }}
          >
            Upgrade now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
