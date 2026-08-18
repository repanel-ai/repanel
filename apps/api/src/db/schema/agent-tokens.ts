import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * The credentials a coding agent connects to the MCP server with. A token
 * names exactly one project, and only its digest is stored, so a leaked table
 * cannot be replayed; deleting the row is what revokes the token, and deleting
 * the project takes its tokens with it.
 */
export const agentTokens = pgTable("agent_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  /** What the human called it, so they can tell one agent's token from another's. */
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Null until the token opens its first MCP session. */
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
