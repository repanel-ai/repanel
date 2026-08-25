CREATE TABLE "definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "definition_versions_project_id_version_unique" UNIQUE("project_id","version")
);
--> statement-breakpoint
ALTER TABLE "definition_versions" ADD CONSTRAINT "definition_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Every project already serving an admin keeps serving it: its valid draft
-- becomes version 1, stamped with the moment it was submitted rather than the
-- moment this ran, so the console reports when the admin went live rather than
-- when it was migrated — and so the draft does not read as newer than it.
--
-- The draft is copied, never moved: the row it came from stays exactly where it
-- was. A project with no valid draft was serving nothing before this and serves
-- nothing after it, which is the state the console and the runtime now teach.
-- Re-runnable by the same token — a project that already has a version is left
-- alone, so this can never resurrect a v1 over something published since.
INSERT INTO "definition_versions" ("project_id", "version", "payload", "published_at")
SELECT "definitions"."project_id", 1, "definitions"."payload", "definitions"."updated_at"
FROM "definitions"
WHERE "definitions"."valid" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "definition_versions"
    WHERE "definition_versions"."project_id" = "definitions"."project_id"
  );
