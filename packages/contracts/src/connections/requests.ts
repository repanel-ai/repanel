import { z } from "zod";

/** The two spellings Postgres answers to. Anything else is not our business. */
const PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/**
 * Whether a string is shaped like a PostgreSQL connection URL that names a
 * database. Shape is all this can tell: whether anything answers at the other
 * end is the test endpoint's question, and it needs a working DSN to ask it.
 *
 * The database is required rather than left off. A path-less URL is legal —
 * the driver then connects to a database named after the role it signed in as
 * — and a panel reading the wrong database is a failure that looks like
 * success. Being explicit is cheap; noticing later is not.
 */
function namesAPostgresDatabase(dsn: string): boolean {
  try {
    const { protocol, pathname } = new URL(dsn);
    return PROTOCOLS.has(protocol) && pathname.slice(1).length > 0;
  } catch {
    return false;
  }
}

/** What `PUT /projects/:id/connection` accepts. The DSN goes no further out. */
export const setConnectionRequestSchema = z.object({
  dsn: z
    .string()
    .trim()
    .refine(
      namesAPostgresDatabase,
      "must be a postgres:// or postgresql:// connection string that names a database",
    ),
});

export type SetConnectionRequest = z.infer<typeof setConnectionRequestSchema>;
