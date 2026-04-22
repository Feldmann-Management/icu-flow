ALTER TABLE "instance_settings" ALTER COLUMN "openai_model" SET DEFAULT 'gpt-5-mini';
--> statement-breakpoint
UPDATE "instance_settings"
SET "openai_model" = 'gpt-5-mini', "updated_at" = now()
WHERE "openai_model" IN ('gpt-4o-mini', 'gpt-4o', 'gpt-4.1');