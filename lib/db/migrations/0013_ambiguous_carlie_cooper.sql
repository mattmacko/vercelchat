ALTER TABLE "User" ADD COLUMN "authProvider" varchar(16) DEFAULT 'credentials' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "googleId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_unique" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_unique" ON "User" USING btree ("googleId") WHERE "User"."googleId" is not null;--> statement-breakpoint
UPDATE "User" SET "email" = lower("email");--> statement-breakpoint
UPDATE "User" SET "authProvider" = 'guest' WHERE "email" LIKE 'guest-%';--> statement-breakpoint
UPDATE "User" SET "authProvider" = 'credentials' WHERE "authProvider" IS NULL;
