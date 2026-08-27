import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * The credential a project's connector dials in with.
 *
 * One per project — a project points at one database one way, and multi-
 * connector high availability is a rung above this one — so the foreign key is
 * unique and minting again replaces the row, which is what revokes the token
 * that was there. Only the digest is stored, so a leaked table cannot be
 * replayed, and deleting the project takes its token with it.
 */
export const connectorTokens = pgTable("connector_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * The last heartbeat this token's connector sent, or null while none ever
   * has. It is what the console's "last seen" reads, and it survives an API
   * restart — which the open socket, being a fact about one process, does not.
   */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});
