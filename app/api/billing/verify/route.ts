export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getSubscriptionPeriodEnd,
  isProEntitledSubscription,
} from "@/lib/billing/entitlement";
import { upsertStripeDetails } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { logError, logInfo, maskEmail } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id parameter" },
      { status: 400 }
    );
  }

  logInfo("billing:verify", "Verifying checkout session", {
    userId: session.user.id,
    email: maskEmail(session.user.email),
    sessionId,
  });

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Verify the session belongs to this user
    if (checkoutSession.client_reference_id !== session.user.id) {
      logError("billing:verify", "Session user mismatch", {
        userId: session.user.id,
        clientReferenceId: checkoutSession.client_reference_id,
      });
      return NextResponse.json(
        { error: "Session does not belong to this user" },
        { status: 403 }
      );
    }

    const paymentStatus = checkoutSession.payment_status;
    const canVerifyPayment =
      paymentStatus === "paid" || paymentStatus === "no_payment_required";

    if (!canVerifyPayment) {
      logInfo("billing:verify", "Payment not yet completed", {
        userId: session.user.id,
        paymentStatus,
      });
      return NextResponse.json({
        verified: false,
        status: paymentStatus,
      });
    }

    const subscription =
      typeof checkoutSession.subscription === "object"
        ? checkoutSession.subscription
        : null;

    const customerId =
      typeof checkoutSession.customer === "string"
        ? checkoutSession.customer
        : (checkoutSession.customer?.id ?? null);

    const subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : (subscription?.id ?? null);

    const isEntitledSubscription = subscription
      ? isProEntitledSubscription(subscription)
      : false;

    if (isEntitledSubscription && subscriptionId) {
      // Get subscription period end for proExpiresAt
      const proExpiresAt = subscription
        ? getSubscriptionPeriodEnd(subscription)
        : null;

      await upsertStripeDetails(session.user.id, {
        tier: "pro",
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId,
        proExpiresAt,
      });

      logInfo("billing:verify", "User upgraded via session verification", {
        userId: session.user.id,
        subscriptionId,
        customerId,
      });

      return NextResponse.json({
        verified: true,
        tier: "pro",
        subscriptionId,
      });
    }

    return NextResponse.json({
      verified: false,
      status: subscription?.status ?? "unknown",
    });
  } catch (error: any) {
    logError("billing:verify", "Failed to verify checkout session", {
      userId: session.user.id,
      sessionId,
      error,
    });

    // If session not found, return gracefully
    if (error?.code === "resource_missing") {
      return NextResponse.json(
        { error: "Checkout session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to verify checkout session" },
      { status: 500 }
    );
  }
}
