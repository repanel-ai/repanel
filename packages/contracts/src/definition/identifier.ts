import { z } from "zod";

/**
 * Every stable key in a definition: resource, field, relationship and action
 * keys, plus the source table name. The runtime always double-quotes these on
 * their way into SQL, so case survives exactly as written and a mixed-case
 * schema needs nothing special. The pattern is narrow because a name outside
 * it could not be written back safely — not because quoting is being avoided.
 */
export const identifierSchema = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "a key of letters, digits and underscores that does not start with a digit",
  );
