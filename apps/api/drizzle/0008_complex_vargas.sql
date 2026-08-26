CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_user_key" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
/* Every project that already existed gains the owner it already had, dated to
   the day the project was made. `do nothing` so that re-running this against a
   database somebody has already backfilled changes nothing. */
INSERT INTO "project_members" ("project_id", "user_id", "role", "created_at")
SELECT "id", "user_id", 'owner', "created_at" FROM "projects"
ON CONFLICT ("project_id", "user_id") DO NOTHING;
