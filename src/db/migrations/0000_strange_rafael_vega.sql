CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"access_token" text,
	"refresh_token" text,
	"refresh_token_expires" timestamp,
	"online_access_info" jsonb,
	CONSTRAINT "session_shop_unique" UNIQUE("shop")
);
--> statement-breakpoint
CREATE TABLE "shop" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shop_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"domain" text NOT NULL,
	"name" text,
	"email" text,
	"timezone" text,
	"currency" text,
	"plan" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX "session_id_idx" ON "session" USING btree ("id");--> statement-breakpoint
CREATE INDEX "session_shop_idx" ON "session" USING btree ("shop");--> statement-breakpoint
CREATE INDEX "shop_domain_idx" ON "shop" USING btree ("domain");