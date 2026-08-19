import { z } from "zod";

/** The two spellings Postgres answers to. Anything else is not our business. */
const PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/**
 * Whether a string is shaped like a PostgreSQL connection URL. Shape is all
 * this can tell: whether anything answers at the other end is the test
 * endpoint's question, and it needs a working DSN to ask it.
 */
function isPostgresUrl(dsn: string): boolean {
  try {
    return PROTOCOLS.has(new URL(dsn).protocol);
  } catch {
    return false;
  }
}

/** What `PUT /projects/:id/connection` accepts. The DSN goes no further out. */
export const setConnectionRequestSchema = z.object({
  dsn: z
    .string()
    .trim()
    .refine(isPostgresUrl, "must be a postgres:// or postgresql:// connection string"),
});

export type SetConnectionRequest = z.infer<typeof setConnectionRequestSchema>;
