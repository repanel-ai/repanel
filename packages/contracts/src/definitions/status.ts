import type { ValidationError } from "../definition/errors.js";

/**
 * How a project's definition stands, for the human watching the console while
 * an agent works. It is not part of the definition schema next door in
 * `definition/` — that is the customer's contract; this is ours, about theirs.
 *
 * A union rather than one shape with nullable fields: there is no "when" for a
 * definition nobody has submitted, and no error list for one that is valid.
 */
export type DefinitionStatusDto =
  | { status: "none" }
  | {
      status: "invalid";
      /** Derived from the list, so the two cannot disagree. */
      errorCount: number;
      /** Every problem found, never truncated. */
      errors: ValidationError[];
    }
  | {
      status: "valid";
      /** ISO 8601: when the agent last submitted this definition. */
      updatedAt: string;
    };
