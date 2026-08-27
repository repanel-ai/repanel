import type { FrameError } from "@repanel/contracts";
import {
  ActionFailedError,
  ConflictError,
  DomainError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  UnservableResourceError,
  ValidationFailedError,
  WriteRefusedError,
  type ActionFailureCode,
} from "../errors/domain-errors";

/** The four an action fails with, which carry their code rather than a class. */
const ACTION_FAILURES = new Set<string>([
  "action_rejected",
  "action_unreachable",
  "action_timeout",
  "action_failed",
]);

/** Every other engine failure, by the code it states. */
const BY_CODE: Record<string, (message: string) => DomainError> = {
  not_found: (message) => new NotFoundError(message),
  conflict: (message) => new ConflictError(message),
  invalid_query: (message) => new InvalidQueryError(message),
  write_refused: (message) => new WriteRefusedError(message),
  query_timeout: (message) => new QueryTimeoutError(message),
  unservable_resource: (message) => new UnservableResourceError(message),
};

/**
 * A connector's refusal, read back into the error the engine raised.
 *
 * The engine ran at the far end, so its `DomainError` did not survive the hop —
 * only its code and its message did, which is exactly what a caller was ever
 * going to be told. Rebuilding the class here is what makes the exception
 * filter answer a connector-served admin with the same status, and the browser
 * with the same envelope, as a directly-connected one.
 *
 * A code this build does not recognize becomes an internal error rather than a
 * status invented for it. That is a disagreement between two builds about what
 * the contract contains, and the version check exists to make it not happen.
 */
export function toDomainError(error: FrameError): Error {
  if (error.code === "validation_failed") {
    return new ValidationFailedError(error.message, error.details ?? []);
  }
  if (ACTION_FAILURES.has(error.code)) {
    return new ActionFailedError(error.code as ActionFailureCode, error.message);
  }

  const known = BY_CODE[error.code];
  return known ? known(error.message) : new Error(`the connector answered with \`${error.code}\``);
}
