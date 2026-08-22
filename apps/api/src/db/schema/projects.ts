import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * A project is what everything else hangs off. Ownership is flat for now: one
 * user, one project, and the project goes when the user does. The key is the
 * routing identity, unique across the install and never reissued.
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  /**
   * The key this project's outbound action requests are signed with, encrypted
   * at rest like every other secret this install holds. Null until the first
   * `httpCall` action needs one — a project that never calls out never mints a
   * secret, and a column full of unused keys is a column full of liabilities.
   */
  actionSecret: text("action_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
