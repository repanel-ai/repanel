import { integer, jsonb, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * A published definition, kept exactly as it was published. Rows here are
 * written once and never again — publishing copies the draft rather than
 * pointing at it, so an edit made a second later cannot reach what operators
 * are being served. That is the whole of the availability argument: the draft
 * next door is what changes, and changing it is not a deployment.
 *
 * The highest version a project has is the one the runtime serves. Rolling back
 * is therefore publishing an earlier payload again as a new version, and the
 * table stays a record of what was live, in the order it was live.
 */
export const definitionVersions = pgTable(
  "definition_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** 1 for a project's first publication, and one more for each after it. */
    version: integer("version").notNull(),
    /** The draft's payload, copied verbatim at the moment it was published. */
    payload: jsonb("payload").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Two publishes racing each other both reach for the same next number; this
  // is what the loser meets, and it is also the index the runtime reads by.
  (table) => [
    unique("definition_versions_project_id_version_unique").on(table.projectId, table.version),
  ],
);
