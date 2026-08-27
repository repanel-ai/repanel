CREATE TABLE "connector_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "connector_tokens_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "connector_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "connections" DROP CONSTRAINT "connections_kind_check";--> statement-breakpoint
--> The one kind there was is now the first of two, and it says which one it is.
--> Written by hand: drizzle-kit changes the constraint, not the rows under it,
--> and the new constraint refuses every row that still says `postgres`.
UPDATE "connections" SET "kind" = 'postgres-direct' WHERE "kind" = 'postgres';--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "kind" SET DEFAULT 'postgres-direct';--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "encrypted_dsn" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connector_tokens" ADD CONSTRAINT "connector_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_dsn_check" CHECK (("connections"."kind" = 'postgres-direct') = ("connections"."encrypted_dsn" is not null));--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_kind_check" CHECK ("connections"."kind" in ('postgres-direct', 'connector'));