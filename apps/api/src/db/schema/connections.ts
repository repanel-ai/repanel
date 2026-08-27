import type { ConnectionKind } from "@repanel/contracts";
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * How a project's database is reached. One row per project, hence the unique
 * foreign key: replacing a connection replaces the row, and deleting the
 * project takes its connection with it.
 *
 * There are two ways in and the row holds exactly one of them. A
 * `postgres-direct` row carries the DSN, and the column keeps only its
 * ciphertext — reading it takes the encryption key, which lives in the
 * environment and not in here. A `connector` row carries no DSN at all,
 * because on that rung RePanel never had one: the customer's own binary holds
 * it and dials out (DECISIONS #064). The check constraint is what keeps
 * "exactly one of them" true in the table itself rather than in whoever wrote
 * the row last.
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ConnectionKind>().notNull().default("postgres-direct"),
    /** Null exactly when the kind is `connector`. */
    encryptedDsn: text("encrypted_dsn"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("connections_kind_check", sql`${table.kind} in ('postgres-direct', 'connector')`),
    check(
      "connections_dsn_check",
      sql`(${table.kind} = 'postgres-direct') = (${table.encryptedDsn} is not null)`,
    ),
  ],
);
