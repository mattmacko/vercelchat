import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  if (!dbUser.stripeCustomerId) {
    return NextResponse.json(
      {
        message:
          "No Stripe customer is associated with this account yet. Please upgrade first.",
      },
      { status: 400 }
    );
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? "/billing/manage";

  return NextResponse.json({ url: portalUrl });
}
