export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getUserById,
  setStripeCustomerId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const stripe = getStripe();
  const origin = process.env.APP_URL ?? request.nextUrl.origin;

  let customerId = dbUser.stripeCustomerId ?? null;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: session.user.email ?? undefined,
          metadata: { userId: session.user.id },
        },
        { idempotencyKey: `cust:${session.user.id}` }
      );

      customerId = customer.id;
      await setStripeCustomerId(session.user.id, customerId);
    }

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: `${origin}/settings/billing`,
      },
      { idempotencyKey: `portal:${session.user.id}:${Date.now()}` }
    );

    if (!portalSession.url) {
      throw new Error("Stripe portal session did not return a URL");
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Stripe portal error", error);
    return NextResponse.json(
      { error: "Failed to create Stripe billing portal session" },
      { status: 500 }
    );
  }
}
