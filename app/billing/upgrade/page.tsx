"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirectToCheckout } from "@/lib/billing/client";
import { LIFETIME_PLAN, PRO_PLAN } from "@/lib/billing/config";
import { guestRegex } from "@/lib/constants";

export default function Page() {
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

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Unlock Pro</h1>
          <p className="mt-2 text-muted-foreground">
            Pick the plan that fits you. Lifetime is the best value.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{LIFETIME_PLAN.name}</CardTitle>
                <Badge variant="secondary">Best value</Badge>
              </div>
              <CardDescription>{LIFETIME_PLAN.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 font-semibold text-4xl">
                {LIFETIME_PLAN.price}
                <span className="font-normal text-muted-foreground text-sm">
                  {LIFETIME_PLAN.interval}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => startCheckout("lifetime")}
              >
                Get lifetime access
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{PRO_PLAN.name}</CardTitle>
              <CardDescription>{PRO_PLAN.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 font-semibold text-4xl">
                {PRO_PLAN.price}
                <span className="font-normal text-muted-foreground text-sm">
                  per {PRO_PLAN.interval}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => startCheckout("monthly")}
                variant="outline"
              >
                Pay monthly
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="font-medium">Everything included</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {PRO_PLAN.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
