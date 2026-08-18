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

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
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
