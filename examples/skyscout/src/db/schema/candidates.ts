import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { airlines } from "./airlines";

/** What the candidate flies, fixes or dispatches. */
export const candidateType = pgEnum("candidate_type", [
  "pilot",
  "cabin_crew",
  "engineer",
  "dispatcher",
]);

/** How far along the candidate is. Coordinators move it; nobody types it. */
export const candidateStatus = pgEnum("candidate_status", [
  "new",
  "screening",
  "verified",
  "placed",
  "rejected",
]);

/**
 * The hostile resource, and deliberately so: a JSONB blob of internal scoring,
 * a soft-delete column, a status that is moved rather than edited, and a
 * nullable foreign key to the airline the candidate is currently placed with.
 * Every trap an authoring agent has to classify correctly is in this table.
 */
export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  type: candidateType("type").notNull(),
  status: candidateStatus("status").notNull().default("new"),
  /** Recruiter scoring and notes: internal, unstable, and nobody's column. */
  profile: jsonb("profile").notNull().default({}),
  /** Set when the candidate is placed; null while they are on the market. */
  airlineId: uuid("airline_id").references(() => airlines.id, { onDelete: "set null" }),
  /** Soft delete: a row with this set is gone as far as the product is concerned. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
