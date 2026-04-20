CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"openai_api_key" text,
	"openai_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
