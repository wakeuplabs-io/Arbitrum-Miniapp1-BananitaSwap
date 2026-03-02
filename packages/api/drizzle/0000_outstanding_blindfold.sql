CREATE TABLE IF NOT EXISTS "auth_nonce" (
	"id" serial PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_nonce_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plcaeholder" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
