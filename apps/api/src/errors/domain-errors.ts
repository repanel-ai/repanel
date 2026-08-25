import { DomainError } from "@repanel/engine";

/**
 * The errors the API answers with. The engine raises most of them and owns
 * their definitions; the control plane adds the ones that are about who is
 * asking rather than about what was asked.
 *
 * They are re-exported through this one module so that a feature imports its
 * errors from one place, and so that `DomainError` has a single identity for
 * the exception filter to catch.
 */
export {
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
} from "@repanel/engine";

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

