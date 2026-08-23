import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Whether an airline may post openings. Moving it is not a field edit: an
 * airline is approved by `POST /repanel/airlines/:id/approve`, which is where
 * the rule that only a pending airline can be approved lives.
 */
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);

/** An operator on the hiring side of the marketplace. */
export const airlines = pgTable("airlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  approvalStatus: approvalStatus("approval_status").notNull().default("pending"),
  /** Compliance working notes: internal shape, internal audience, not a column. */
  verification: jsonb("verification").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
