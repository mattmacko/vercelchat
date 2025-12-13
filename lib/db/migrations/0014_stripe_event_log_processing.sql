ALTER TABLE "stripe_event_log" ADD COLUMN "status" varchar(16) DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_event_log" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_event_log" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_event_log" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_event_log" ADD COLUMN "last_error" text;--> statement-breakpoint
UPDATE "stripe_event_log"
SET status = 'processed',
	processing_started_at = COALESCE("stripe_event_log"."processing_started_at", "stripe_event_log"."seen_at"),
	processed_at = COALESCE("stripe_event_log"."processed_at", "stripe_event_log"."seen_at"),
	attempt_count = CASE WHEN "stripe_event_log"."attempt_count" = 0 THEN 1 ELSE "stripe_event_log"."attempt_count" END
WHERE "stripe_event_log"."processed_at" IS NULL;

