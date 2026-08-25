import type { ValidationError } from "../definition/errors.js";
import type { PublishedDefinitionDto } from "./published.js";

/**
 * How the last submission fared. It is not part of the definition schema next
 * door in `definition/` — that is the customer's contract; this is ours, about
 * theirs.
 *
 * A union rather than one shape with nullable fields: there is no "when" for a
 * definition nobody has submitted, and no error list for one that is valid.
 */
export type DraftStatusDto =
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

/**
 * Where a project's definition stands, for the human watching the console
 * while an agent works.
 *
 * Two facts rather than one, because they move independently and that is the
 * whole point of publishing: what the agent last submitted, and what operators
 * are being served meanwhile. A draft that does not validate says nothing about
 * whether an admin is up.
 */
export interface DefinitionStatusDto {
  draft: DraftStatusDto;
  /** The version the admin is serving, or null while nothing has been published. */
  published: PublishedDefinitionDto | null;
  /** The draft was submitted after that version: there is something new to publish. */
  unpublishedChanges: boolean;
}
