import type { ErrorEnvelope } from "@repanel/contracts";
import {
  ActionFailedError,
  ConflictError,
  DomainError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "@repanel/engine";
import { UnreadableQueryError } from "./query-params.js";
import { UnreadableBodyError } from "./request-body.js";

export interface Failure {
  readonly status: number;
  readonly body: ErrorEnvelope;
  /**
   * Nothing recognized this, so it is ours. The envelope says nothing about it
   * — and something has to, or a local server swallows the one thing its
   * operator could have acted on.
   */
  readonly unexpected: boolean;
}

/**
 * What a failure becomes on the wire — the same status and the same envelope
 * the hosted API answers with, because the runtime reading them is the same
 * build. The engine deliberately decides none of this itself: a host is given
 * a code and says what it means over HTTP, and this is the local host.
 *
 * Nothing else is passed on. An error with no mapping is a fault of ours, and
 * it reads as one rather than as something the operator did.
 */
export function failureOf(error: unknown): Failure {
  if (error instanceof UnreadableQueryError || error instanceof UnreadableBodyError) {
    return envelope(400, "bad_request", error.message);
  }
  if (error instanceof ValidationFailedError) {
    // The details are the whole point of this envelope: they are what a form
    // puts under the input each one names.
    return envelope(422, error.code, error.message, error.details);
  }
  if (error instanceof DomainError) {
    return envelope(statusOf(error), error.code, error.message);
  }
  return { ...envelope(500, "internal_error", "Internal server error"), unexpected: true };
}

function statusOf(error: DomainError): number {
  // A failure of the application the action called, answered as one: RePanel
  // signed and sent the request, and what is upstream of it did not accept it.
  if (error instanceof ActionFailedError) return error.code === "action_timeout" ? 504 : 502;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof InvalidQueryError) return 400;
  if (error instanceof ConflictError) return 409;
  // Understood, and declined: the definition offers no such write.
  if (error instanceof WriteRefusedError) return 403;
  if (error instanceof QueryTimeoutError) return 504;
  // `UnservableResourceError` lands here on purpose, as it does in the hosted
  // API: a resource the engine refuses to serve is a definition that should
  // never have passed validation, which is ours to fix and reads as ours.
  return 500;
}

function envelope(
  status: number,
  code: string,
  message: string,
  details?: ErrorEnvelope["error"]["details"],
): Failure {
  const body: ErrorEnvelope = { error: { code, message } };
  if (details) body.error.details = details;
  return { status, body, unexpected: false };
}
