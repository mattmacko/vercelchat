export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserById, setStripeCustomerId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { logError, logInfo, maskEmail } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/client";

const HTTP_URL_REGEX = /^https?:\/\//;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    logError("billing:portal", "Missing session user during billing portal", {
      hasSession: Boolean(session),
    });
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  logInfo("billing:portal", "Billing portal request received", {
    userId: session.user.id,
    userType: session.user.type,
    email: maskEmail(session.user.email),
  });

  if (session.user.type === "guest") {
    logInfo("billing:portal", "Blocked guest user from billing portal", {
      userId: session.user.id,
    });
    return new ChatSDKError(
      "forbidden:auth",
      "Create an account before managing billing."
    ).toResponse();
  }

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    logError("billing:portal", "No database user found for session", {
      userId: session.user.id,
    });
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const stripe = getStripe();
  const origin = process.env.APP_URL ?? request.nextUrl.origin;
  const portalPath =
    process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? "/billing/manage";
  const returnUrl = HTTP_URL_REGEX.test(portalPath)
    ? portalPath
    : `${origin}${portalPath.startsWith("/") ? portalPath : `/${portalPath}`}`;

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
        logInfo("billing:portal", "Created Stripe customer", {
          userId: session.user.id,
          customerId,
        });
        await setStripeCustomerId(session.user.id, customerId);
      }

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: returnUrl,
      },
      { idempotencyKey: `portal:${session.user.id}:${Date.now()}` }
    );

    if (!portalSession.url) {
      throw new Error("Stripe portal session did not return a URL");
    }

    logInfo("billing:portal", "Billing portal session created", {
      userId: session.user.id,
      customerId,
      returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    logError("billing:portal", "Stripe portal error", {
      userId: session.user.id,
      error,
    });
    return NextResponse.json(
      { error: "Failed to create Stripe billing portal session" },
      { status: 500 }
    );
  }
}
