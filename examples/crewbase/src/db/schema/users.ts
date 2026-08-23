import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Where a staffing coordinator's account stands. */
export const userStatus = pgEnum("user_status", ["invited", "active", "suspended"]);

/**
 * Crewbase's own staff: the people who run placements. `password_hash` is here
 * because a real application keeps it here — it is the column an admin must
 * never render, and an example without it would be teaching against the case
 * that matters.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  status: userStatus("status").notNull().default("invited"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
