ALTER TABLE "User" ADD COLUMN "stripeCustomerId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "proExpiresAt" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_tier_idx" ON "User" USING btree ("tier");