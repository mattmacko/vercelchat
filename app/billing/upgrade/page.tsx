"use client";

import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirectToCheckout } from "@/lib/billing/client";
import { LIFETIME_PLAN, PRO_PLAN } from "@/lib/billing/config";
import { guestRegex } from "@/lib/constants";

export default function Page() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const autoCheckoutStarted = useRef(false);
  const lifetimeSpots = LIFETIME_PLAN.spotsRemaining;
  const lifetimeValueNote = LIFETIME_PLAN.valueNote;
  const cardBase =
    "relative flex h-full flex-col rounded-2xl border p-6 text-left shadow-sm transition";
  const lifetimeCard =
    "border-emerald-200/70 bg-emerald-50/70 text-foreground shadow-[0_24px_60px_-40px_rgba(16,185,129,0.55)] dark:border-emerald-500/40 dark:bg-emerald-500/10";
  const proCard =
    "border-zinc-900/30 bg-zinc-950 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.65)] dark:border-white/10 dark:bg-zinc-950";

  const planParam = searchParams.get("plan");
  const autoParam = searchParams.get("auto");
  const selectedPlan =
    planParam === "monthly" || planParam === "lifetime" ? planParam : null;
  const shouldAutoCheckout = autoParam === "1" && selectedPlan !== null;

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
      void signIn("google", {
        callbackUrl: `/billing/upgrade?plan=${plan}&auto=1`,
      });
      return;
    }

    void redirectToCheckout(plan);
  };

  useEffect(() => {
    if (!shouldAutoCheckout) {
      return;
    }

    if (!selectedPlan) {
      return;
    }

    if (autoCheckoutStarted.current) {
      return;
    }

    if (status === "loading") {
      return;
    }

    autoCheckoutStarted.current = true;

    const isGuest = guestRegex.test(session?.user?.email ?? "");

    if (isGuest) {
      void signIn("google", {
        callbackUrl: `/billing/upgrade?plan=${selectedPlan}&auto=1`,
      });
      return;
    }

    void redirectToCheckout(selectedPlan);
  }, [selectedPlan, session?.user?.email, shouldAutoCheckout, status]);

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-gradient-to-b from-background via-background to-muted/40 px-4 py-12 dark:to-black sm:px-6">
      <div className="w-full max-w-5xl">
        <div className="rounded-3xl border border-black/5 bg-gradient-to-b from-white to-slate-50 p-6 shadow-xl dark:border-white/10 dark:from-zinc-950 dark:to-zinc-900 sm:p-10">
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Upgrade to {PRO_PLAN.name}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Pick the plan that fits you. Lifetime is the best value.
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className={`${cardBase} ${lifetimeCard}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                  Founder&apos;s access
                </span>
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
                  Best value
                </Badge>
              </div>
              {typeof lifetimeSpots === "number" && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700/90 dark:text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {lifetimeSpots} spots remaining
                </div>
              )}
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-[var(--font-instrument-serif)] text-4xl sm:text-5xl">
                  {LIFETIME_PLAN.price}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {LIFETIME_PLAN.interval}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {LIFETIME_PLAN.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                {LIFETIME_PLAN.features.map((feature) => (
                  <li className="flex items-center gap-2" key={feature}>
                    <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {lifetimeValueNote && (
                <p className="mt-4 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                  {lifetimeValueNote}
                </p>
              )}
              <div className="mt-auto pt-6">
                <Button
                  className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                  onClick={() => startCheckout("lifetime")}
                >
                  Get lifetime access
                </Button>
              </div>
            </div>

            <div className={`${cardBase} ${proCard}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {PRO_PLAN.name}
                </span>
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-[var(--font-instrument-serif)] text-4xl text-white sm:text-5xl">
                  {PRO_PLAN.price}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">
                  per {PRO_PLAN.interval}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/70">
                {PRO_PLAN.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                {PRO_PLAN.features.map((feature) => (
                  <li className="flex items-center gap-2" key={feature}>
                    <CheckIcon className="h-4 w-4 text-white/70" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Button
                  className="w-full rounded-full bg-white text-zinc-900 hover:bg-white/90"
                  onClick={() => startCheckout("monthly")}
                >
                  Pay monthly
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              Secure checkout
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              Pay once, own it forever
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              Cancel anytime
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
