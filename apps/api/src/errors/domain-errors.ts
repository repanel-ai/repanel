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

/**
 * There is no connector holding a channel open for this project, so the
 * request never left RePanel. Deliberately its own category rather than a
 * timeout: nothing was asked of the customer's database, nothing is
 * half-finished there, and the thing to go and do is start the connector.
 */
export class ConnectorOfflineError extends DomainError {
  readonly code = "connector_offline";
}

/**
 * The connector was there and did not answer inside the time the hop was given.
 *
 * Told apart from `QueryTimeoutError` on purpose, and the distinction is the
 * operator's rather than ours. `query_timeout` means the customer's database
 * was asked and took too long, which is a fact about a query and is fixed with
 * an index. This means the hop said nothing at all — the connector may be
 * wedged, the network may be gone — and reading one as the other sends somebody
 * to tune a query that was never slow (DECISIONS #064).
 *
 * The hop's bound is always strictly longer than the statement's, so a slow
 * query is answered as one by the side that actually knows.
 */
export class ConnectorTimeoutError extends DomainError {
  readonly code = "connector_timeout";
}
