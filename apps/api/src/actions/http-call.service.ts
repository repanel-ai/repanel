import { Injectable } from "@nestjs/common";
import type { HttpMethod } from "@repanel/contracts";
import { ActionFailedError } from "../errors/domain-errors";
import { signRequest } from "./action-signature";

/**
 * How long the customer's application has to answer. Long enough for an
 * endpoint that talks to a payment processor on the way, short enough that an
 * operator finds out rather than waits.
 */
export const CALL_TIMEOUT_MS = 10_000;

export interface OutboundCall {
  method: HttpMethod;
  /** Absolute, and already resolved against the record. */
  url: string;
  /** The project's action secret. It is used here and stored nowhere else. */
  secret: string;
}

/**
 * The one place RePanel calls out to a customer's application.
 *
 * Every request it sends is signed (DECISIONS #013) and bounded by a timeout,
 * and nothing that comes back is passed on. A response body is the customer's
 * own data on its way into an operator's browser, and RePanel has no idea what
 * is in it — so it is cancelled unread, and the caller learns which of four
 * things happened.
 */
@Injectable()
export class HttpCallService {
  async send({ method, url, secret }: OutboundCall): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: signRequest({ secret, timestamp, method, url }),
        // v0 sends no body: an action carries no inputs, so the request line is
        // the whole of what there is to say and the whole of what is signed.
        //
        // Redirects are not followed. The signature covers the URL the
        // definition named, so a hop would arrive somewhere else carrying proof
        // for somewhere else — and an admin action landing at an address the
        // definition never wrote down is not a thing to be relaxed about. A 3xx
        // is read as the application declining to handle it here.
        redirect: "manual",
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (error) {
      throw categorize(error);
    }

    // Read by nobody, on purpose — and cancelled rather than ignored, so the
    // connection is not held open waiting for a reader that never comes.
    await response.body?.cancel().catch(() => undefined);

    if (!response.ok) {
      throw new ActionFailedError(
        "action_rejected",
        `The application answered ${response.status}, so the action did not report success.`,
      );
    }
  }
}

/**
 * What went wrong, as one of the four categories. `fetch` rejects with a
 * `TimeoutError` when its signal fires and with a `TypeError` for everything
 * network-shaped, which is the whole of the split — the fourth category exists
 * for the case neither covers, and says so rather than guessing.
 *
 * Read by name rather than by `instanceof`. What comes back from `fetch` was
 * constructed inside Node's own realm, and a class identity does not survive
 * crossing one — the spec fixes these names, not the constructor a caller
 * happens to be holding.
 */
function categorize(error: unknown): ActionFailedError {
  const name = (error as { name?: unknown } | null | undefined)?.name;

  if (name === "TimeoutError" || name === "AbortError") {
    return new ActionFailedError(
      "action_timeout",
      `The application did not answer within ${CALL_TIMEOUT_MS / 1000} seconds.`,
    );
  }
  if (name === "TypeError") {
    return new ActionFailedError("action_unreachable", "The application could not be reached.");
  }
  return new ActionFailedError("action_failed", "The call to the application did not go through.");
}
