import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { FREE_LIFETIME_MESSAGE_LIMIT } from "@/lib/billing/config";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const now = new Date();
  const isPro =
    dbUser.tier === "pro" &&
    dbUser.proExpiresAt !== null &&
    dbUser.proExpiresAt.getTime() > now.getTime();

  const limit = isPro ? null : FREE_LIFETIME_MESSAGE_LIMIT;
  const used = dbUser.messagesSentCount;
  const remaining =
    limit === null ? null : Math.max(limit - dbUser.messagesSentCount, 0);

  const checkoutUrl =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL ?? "/billing/upgrade";
  const portalUrl =
    process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? "/billing/manage";

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
