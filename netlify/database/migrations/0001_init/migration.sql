CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120) DEFAULT '' NOT NULL,
	"role" varchar(16) DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campaign_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"platform" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"region" text NOT NULL,
	"funnel_stage" text NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"roas" numeric(8, 4) DEFAULT '0' NOT NULL,
	"current_budget" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_snapshots_uniq" UNIQUE("snapshot_date","platform","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "budget_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_date" date NOT NULL,
	"platform" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"region" text NOT NULL,
	"funnel_stage" text NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"roas" numeric(8, 4) NOT NULL,
	"current_budget" numeric(12, 2) NOT NULL,
	"current_weight_pct" numeric(6, 4) NOT NULL,
	"recommended_budget" numeric(12, 2) NOT NULL,
	"recommended_weight_pct" numeric(6, 4) NOT NULL,
	"budget_delta" numeric(12, 2) NOT NULL,
	"floor_triggered" boolean DEFAULT false NOT NULL,
	"z1_boosted" boolean DEFAULT false NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "budget_recommendations_uniq" UNIQUE("recommendation_date","platform","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
