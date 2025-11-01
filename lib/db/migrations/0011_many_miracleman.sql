CREATE TABLE IF NOT EXISTS "stripe_event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now()
);
