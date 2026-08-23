import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { candidates } from "./candidates";
import { jobOpenings } from "./job-openings";

/** Where one candidate stands on one opening. */
export const applicationStatus = pgEnum("application_status", [
  "submitted",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

/** One candidate against one opening: the join both sides of the market read. */
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  openingId: uuid("opening_id")
    .notNull()
    .references(() => jobOpenings.id, { onDelete: "cascade" }),
  status: applicationStatus("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
