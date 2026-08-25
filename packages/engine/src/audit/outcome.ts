import type { AuditOutcome } from "@repanel/contracts";
import { DomainError } from "../errors.js";

/** What a failure is recorded as: which kind it was, and which one. */
export interface Failure {
  outcome: AuditOutcome;
  reason: string;
}

/**
 * The codes that mean somebody decided against this, as opposed to something
 * going wrong on the way. Asking again the same way gets the same answer from
 * every one of them: a constraint the database owns, a value the definition
 * does not accept, a record that is not there, an application that said no.
 */
const REFUSALS: ReadonlySet<string> = new Set([
  "conflict",
  "validation_failed",
  "write_refused",
  "not_found",
  "invalid_query",
  "action_rejected",
]);

/** Ours, and it reads as ours: nothing decided this, something broke. */
const INTERNAL = "internal_error";

/**
 * What a thrown failure is recorded as.
 *
 * The category is read off the code the error already carries — the same code
 * the request itself is answered with — rather than off a second vocabulary
 * invented here. So the line in the log and the line in the browser's network
 * tab say the same word about the same event, and a code that is added to the
 * engine appears in the log without this file being edited.
 *
 * Anything that is not a domain error is a fault of ours. It is recorded as
 * `failed` under a name that says so, and never with the message, which names
 * hosts, columns and the values that were sent.
 */
export function outcomeOf(error: unknown): Failure {
  const reason = error instanceof DomainError ? error.code : INTERNAL;

  return { outcome: REFUSALS.has(reason) ? "refused" : "failed", reason };
}
