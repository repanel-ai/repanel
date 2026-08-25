import type { ValidationError } from "@repanel/contracts";

/**
 * What the engine throws. Each carries a stable, client-safe `code`; deciding
 * what a code becomes on the wire belongs to whoever is serving the request, so
 * no transport concern reaches in here.
 *
 * The base class lives with the engine because the engine is where most of
 * these are raised, and because a host that catches `DomainError` has to catch
 * one class rather than two — `apps/api` re-exports these beside its own
 * control-plane errors, which extend this same base.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = "not_found";
}

/**
 * What was asked for is already there, or is no longer the thing it was asked
 * about. Raised where a constraint the database owns is the authority on the
 * answer — a unique index refusing a second row is exactly such a case, and a
 * pre-check that only sometimes wins the race is not (DECISIONS #016).
 */
export class ConflictError extends DomainError {
  readonly code = "conflict";
}

/**
 * Input that parsed and did not hold up. The details are the same shape a
 * definition's problems come back in (DECISIONS #008) — a path, what is wrong,
 * what would be right, and the fix — because the renderer puts them under the
 * input they belong to, and a path that does not resolve to a field is a
 * message nobody can place.
 */
export class ValidationFailedError extends DomainError {
  readonly code = "validation_failed";

  constructor(
    message: string,
    readonly details: readonly ValidationError[],
  ) {
    super(message);
  }
}

/**
 * The definition does not offer this write at all. Not a malformed request and
 * not a missing record: the request was understood and the admin it was sent to
 * declines to perform it, which is the same answer however it is asked again.
 */
export class WriteRefusedError extends DomainError {
  readonly code = "write_refused";
}

/**
 * The request asked a valid definition for something it does not offer: a field
 * it declares no filter on, a sort it cannot serve, a value outside an enum.
 * The message names what would have worked — a query is written by hand far
 * more often than a definition is.
 */
export class InvalidQueryError extends DomainError {
  readonly code = "invalid_query";
}

/** The customer's database did not answer inside the time it was given. */
export class QueryTimeoutError extends DomainError {
  readonly code = "query_timeout";
}

/**
 * A resource the engine refuses to serve at all, because serving it would
 * break a rule the definition should never have let through. Deliberately not
 * given a status of its own: it is a failure of ours, it reads as one, and the
 * message says which resource so it can be repaired.
 */
export class UnservableResourceError extends DomainError {
  readonly code = "unservable_resource";
}

/**
 * Why a call to a customer's application did not succeed, in categories rather
 * than in the application's own words.
 *
 * The categories are the public part. A customer's response body is never
 * forwarded — it is their data, on its way into an operator's browser, and
 * RePanel has no idea what is in it — so what a caller gets is which of four
 * things happened and nothing else. `action_failed` is the honest fourth: it
 * says the call did not succeed and does not pretend to know why.
 */
export type ActionFailureCode =
  | "action_rejected"
  | "action_unreachable"
  | "action_timeout"
  | "action_failed";

/**
 * The customer's application did not accept the action. It is their failure and
 * it reads as one — a host answers it with a gateway status, because RePanel
 * did its part and the thing on the other end did not.
 */
export class ActionFailedError extends DomainError {
  constructor(
    readonly code: ActionFailureCode,
    message: string,
  ) {
    super(message);
  }
}
