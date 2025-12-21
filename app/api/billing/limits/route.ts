import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { FREE_LIFETIME_MESSAGE_LIMIT } from "@/lib/billing/config";
import { isUserProEntitled } from "@/lib/billing/entitlement";
import { getUserById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { logError, logInfo, maskEmail } from "@/lib/logging";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    logError("billing:limits", "Unauthorized access (missing session user)", {
      hasSession: Boolean(session),
    });
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  logInfo("billing:limits", "Fetching billing limits", {
    userId: session.user.id,
    userType: session.user.type,
    email: maskEmail(session.user.email),
  });

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    logError("billing:limits", "No database user found for session", {
      userId: session.user.id,
    });
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const isPro = isUserProEntitled(dbUser);

  const limit = isPro ? null : FREE_LIFETIME_MESSAGE_LIMIT;
  const used = dbUser.messagesSentCount;
  const remaining =
    limit === null ? null : Math.max(limit - dbUser.messagesSentCount, 0);

  const checkoutUrl =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL ?? "/billing/upgrade";
  const portalUrl =
    process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? "/billing/manage";

  logInfo("billing:limits", "Computed billing limits response", {
    userId: session.user.id,
    isPro,
    used,
    limit,
    remaining,
    proExpiresAt: dbUser.proExpiresAt,
  });

  return NextResponse.json({
    isPro,
    used,
    limit,
    remaining,
    checkoutUrl,
    portalUrl,
    proExpiresAt: dbUser.proExpiresAt,
  });
}
