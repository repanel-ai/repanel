import { AUDIT_KINDS, AUDIT_OUTCOMES } from "@repanel/contracts";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

/**
 * Everything RePanel has done to a customer's records, in the order it did it.
 *
 * Rows here are written once and never again. There is no update, no delete and
 * no retention policy in v1: a log an operator can edit answers "who did this"
 * with whatever the last person to touch it wanted it to say, and the column
 * that would age rows out is the column that would quietly remove the evidence
 * (DECISIONS #061). What that costs is stated in THREAT-MODEL §8.3.
 *
 * The actor is kept twice on purpose. The id is the link, and the email is a
 * snapshot: a person who changes their address does not thereby change what the
 * log says about last Tuesday.
 *
 * The events go when the project does, because everything else here does — a
 * deleted project takes its connection, its definitions and its versions with
 * it, and a log of a project nobody can reach is a log nobody can read.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** What the actor was called at the time, and not necessarily since. */
    actorEmail: text("actor_email").notNull(),
    /** The resource, by the key its definition gave it. */
    resourceKey: text("resource_key").notNull(),
    /**
     * The record it was about, as text. A customer's primary key is a uuid, a
     * slug or a number, and the one thing all three survive being written as is
     * their own characters — which is also how the runtime addresses a record.
     * Null for a create that never got as far as a key.
     */
    recordPk: text("record_pk"),
    kind: text("kind", { enum: AUDIT_KINDS }).notNull(),
    /** The action's key, for an `action`; null for a form write. */
    actionKey: text("action_key"),
    /** The columns the write named, as they stood. Null where nothing was read. */
    before: jsonb("before"),
    after: jsonb("after"),
    outcome: text("outcome", { enum: AUDIT_OUTCOMES }).notNull(),
    /** Which refusal or which failure; null when the outcome is `ok`. */
    reason: text("reason"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One record's own history, newest first, is the only question this table is
  // asked — the console-wide browse that would ask others is post-MVP.
  (table) => [
    index("audit_events_record_idx").on(
      table.projectId,
      table.resourceKey,
      table.recordPk,
      table.at,
    ),
  ],
);
