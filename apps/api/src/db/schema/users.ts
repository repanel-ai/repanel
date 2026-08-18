import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Control-plane users. Emails are stored lowercased — the request schema
 * normalizes them — so the unique constraint means one account per address.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
