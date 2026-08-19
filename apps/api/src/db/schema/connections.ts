import type { ConnectionKind } from "@repanel/contracts";
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * The customer database a project points at. The DSN is the most sensitive
 * thing this install holds, so the column keeps only its ciphertext; reading it
 * takes the encryption key, which lives in the environment and not in here.
 * One row per project, hence the unique foreign key: replacing a connection
 * replaces the row, and deleting the project takes its connection with it.
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Which database is at the other end. Postgres is the only answer today,
     *  and the check constraint is what keeps that true in the table itself. */
    kind: text("kind").$type<ConnectionKind>().notNull().default("postgres"),
    encryptedDsn: text("encrypted_dsn").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("connections_kind_check", sql`${table.kind} = 'postgres'`)],
);
