import type { ValidationError } from "@repanel/contracts";

/**
 * What services throw. Carries a stable, client-safe `code`; the exception
 * filter decides the HTTP status, so transport concerns stay out of the domain.
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
 * The request carries no usable identity. Says nothing more than that: which
 * half of a credential was wrong is not the caller's business.
 */
export class UnauthorizedError extends DomainError {
  readonly code = "unauthorized";
}

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
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
 * A resource the runtime refuses to serve at all, because serving it would
 * break a rule the definition should never have let through. Deliberately not
 * given a status of its own: it is a failure of ours, it reads as one, and the
 * message says which resource so it can be repaired.
 */
export class UnservableResourceError extends DomainError {
  readonly code = "unservable_resource";
}

/** Input that parsed but did not hold up. Details use the contracts error shape. */
export class ValidationFailedError extends DomainError {
  readonly code = "validation_failed";

  constructor(
    message: string,
    readonly details: readonly ValidationError[],
  ) {
    super(message);
  }
}
