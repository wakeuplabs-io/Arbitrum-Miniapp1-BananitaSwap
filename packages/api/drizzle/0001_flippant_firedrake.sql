CREATE TABLE IF NOT EXISTS "user_profile" (
	"user_address" text PRIMARY KEY NOT NULL,
	"profile_image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
