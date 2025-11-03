export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { POST as stripeWebhookHandler } from "@/app/api/stripe/webhook/route";

export async function POST(request: NextRequest) {
  console.warn(
    "Stripe webhook invoked via /webhook alias; consider updating Stripe endpoint to /api/stripe/webhook."
  );

  return stripeWebhookHandler(request);
}
