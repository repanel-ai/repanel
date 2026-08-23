import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { airlines } from "./airlines";

/** Whether an opening is taking applications. */
export const openingStatus = pgEnum("opening_status", ["draft", "open", "closed"]);

/** A seat an approved airline is hiring for. */
export const jobOpenings = pgTable("job_openings", {
  id: uuid("id").primaryKey().defaultRandom(),
  airlineId: uuid("airline_id")
    .notNull()
    .references(() => airlines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: openingStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
