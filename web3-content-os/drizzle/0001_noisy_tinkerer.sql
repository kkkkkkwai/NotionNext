CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"ref" text,
	"balance_after" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"config_enc" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "organization_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "project_fact_conflicts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"fact_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"current_value" text NOT NULL,
	"proposed_value" text NOT NULL,
	"source" text,
	"source_ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"content_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"external_id" text,
	"url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "publish_channel" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "auto_publish" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "published_url" text;--> statement-breakpoint
CREATE INDEX "credit_tx_org_idx" ON "credit_transactions" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_project_kind" ON "integrations" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "invites_org_idx" ON "organization_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fact_conflicts_project_idx" ON "project_fact_conflicts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "publish_logs_project_idx" ON "publish_logs" USING btree ("project_id");