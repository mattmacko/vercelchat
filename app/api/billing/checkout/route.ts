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

  if (dbUser.tier === "pro" && dbUser.proExpiresAt && dbUser.proExpiresAt > new Date()) {
    return NextResponse.json(
      { message: "You are already on the Pro plan." },
      { status: 200 }
    );
  }

  const checkoutUrl =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL ?? "/billing/upgrade";

  return NextResponse.json({ url: checkoutUrl });
}
