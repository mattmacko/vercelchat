"use client";

import { CheckIcon } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
  const lifetimeSpots = LIFETIME_PLAN.spotsRemaining;
  const lifetimeValueNote = LIFETIME_PLAN.valueNote;
  const cardBase =
    "relative flex h-full flex-col rounded-3xl border p-8 text-left transition duration-300 hover:scale-[1.01] hover:shadow-xl";
  // Updated Lifetime Card: Pure white with elegant emerald accents
  const lifetimeCard =
    "border-emerald-100 bg-white shadow-2xl shadow-emerald-900/5 ring-1 ring-emerald-500/10 dark:border-emerald-900/50 dark:bg-zinc-900 dark:ring-emerald-500/20";
  // Updated Pro Card: Neutral white for light mode, deep black for dark mode
  const proCard =
    "border-zinc-200 bg-white text-zinc-900 shadow-2xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-black dark:text-white";

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
      onOpenChange(false);
      signIn("google", {
        callbackUrl: `/billing/upgrade?plan=${plan}&auto=1`,
      });
      return;
    }

    redirectToCheckout(plan);
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
      <AlertDialogContent className="w-[92vw] max-w-4xl border-0 bg-transparent p-0 shadow-none">
        <div className="rounded-[40px] border border-zinc-200 bg-white p-6 shadow-2xl sm:p-10 dark:border-zinc-800 dark:bg-zinc-950">
          <AlertDialogHeader className="space-y-4 text-left">
            <AlertDialogTitle className="font-semibold text-3xl text-zinc-900 tracking-tight sm:text-4xl dark:text-zinc-50">
              Upgrade to {PRO_PLAN.name}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-zinc-500 dark:text-zinc-400">
              You&apos;ve used all available messages on the free plan. Lifetime
              is the best value.
            </AlertDialogDescription>
            {numericLimit !== null && (
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1 font-medium text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Free plan: {numericLimit} lifetime messages
              </div>
            )}
          </AlertDialogHeader>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className={`${cardBase} ${lifetimeCard}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 text-xs uppercase tracking-[0.2em] dark:text-emerald-400">
                  Founder&apos;s access
                </span>
                <Badge className="border-emerald-500/10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Best value
                </Badge>
              </div>
              {typeof lifetimeSpots === "number" && (
                <div className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {lifetimeSpots} spots remaining
                </div>
              )}
              <div className="mt-8 flex items-baseline gap-2">
                <span className="font-[var(--font-instrument-serif)] text-6xl text-zinc-900 sm:text-7xl dark:text-zinc-50">
                  {LIFETIME_PLAN.price}
                </span>
                <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest">
                  {LIFETIME_PLAN.interval}
                </span>
              </div>
              <p className="mt-4 text-sm text-zinc-500 leading-relaxed dark:text-zinc-400">
                {LIFETIME_PLAN.description}
              </p>
              <ul className="mt-8 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                {LIFETIME_PLAN.features.map((feature) => (
                  <li className="flex items-center gap-3" key={feature}>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
              {lifetimeValueNote && (
                <p className="mt-6 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                  {lifetimeValueNote}
                </p>
              )}
              <div className="mt-auto pt-10">
                <Button
                  className="h-12 w-full rounded-2xl bg-emerald-600 text-white shadow-emerald-600/20 shadow-lg hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                  onClick={() => startCheckout("lifetime")}
                >
                  Get lifetime access
                </Button>
              </div>
            </div>

            <div className={`${cardBase} ${proCard}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-400 uppercase tracking-[0.2em]">
                  {PRO_PLAN.name}
                </span>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="font-[var(--font-instrument-serif)] text-6xl text-zinc-900 sm:text-7xl dark:text-zinc-50">
                  {PRO_PLAN.price}
                </span>
                <span className="font-bold text-xs text-zinc-500 uppercase tracking-widest">
                  per {PRO_PLAN.interval}
                </span>
              </div>
              <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                {PRO_PLAN.description}
              </p>
              <ul className="mt-8 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                {PRO_PLAN.features.map((feature) => (
                  <li className="flex items-center gap-3" key={feature}>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-white/70">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-10">
                <Button
                  className="h-12 w-full rounded-2xl border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
                  onClick={() => startCheckout("monthly")}
                  variant="outline"
                >
                  Pay monthly
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6 border-zinc-100 border-t pt-8 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-6 font-semibold">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Pay once, own it forever
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Cancel anytime
              </span>
            </div>
            <AlertDialogCancel className="w-full border-0 bg-transparent px-0 text-zinc-400 transition-colors hover:bg-transparent hover:text-zinc-600 sm:w-auto sm:px-4">
              Maybe later
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
