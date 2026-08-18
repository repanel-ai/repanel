import type { ValidationError } from "@repanel/contracts";
import { boolean, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * A project's current definition draft. One row per project in the POC, hence
 * the unique foreign key: a resubmission replaces what is there rather than
 * adding to it. Invalid drafts are stored too — the authoring agent has to be
 * able to read back the payload that failed alongside why it failed.
 */
export const definitions = pgTable("definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  valid: boolean("valid").notNull(),
  /** The errors validation reported, verbatim; null exactly when valid. */
  errors: jsonb("errors").$type<ValidationError[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
