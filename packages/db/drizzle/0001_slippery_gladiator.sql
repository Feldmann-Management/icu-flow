CREATE TABLE "app_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"github_app_id" bigint NOT NULL,
	"github_app_slug" text NOT NULL,
	"github_app_client_id" text NOT NULL,
	"github_app_client_secret" text NOT NULL,
	"github_app_webhook_secret" text NOT NULL,
	"github_app_private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
