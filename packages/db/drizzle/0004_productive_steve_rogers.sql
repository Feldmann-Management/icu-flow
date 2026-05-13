CREATE TABLE "repo_translation_rules" (
	"repo_id" uuid PRIMARY KEY NOT NULL,
	"general_rules" text DEFAULT '' NOT NULL,
	"language_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repo_translation_rules" ADD CONSTRAINT "repo_translation_rules_repo_id_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repo"("id") ON DELETE cascade ON UPDATE no action;