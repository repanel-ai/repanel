import { z } from "zod";

/**
 * Every stable key in a definition: resource, field, relationship and action
 * keys, plus the source table name. Deliberately narrow — these values are
 * interpolated into SQL identifiers by the runtime, so they stay to the
 * conservative subset of unquoted postgres identifiers.
 */
export const identifierSchema = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "a key of letters, digits and underscores that does not start with a digit",
  );
