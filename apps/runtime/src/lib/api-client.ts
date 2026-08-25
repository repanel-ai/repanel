import type { ErrorEnvelope, ValidationError } from "@repanel/contracts";

/**
 * The renderer's own client. It shares the console's conventions and none of
 * its code: the two apps' API surfaces diverge from here on, and one client
 * serving both would have to grow every endpoint either of them needs.
 *
 * The path is relative: the dev server proxies /api to the API and strips the
 * prefix, so the browser only ever talks to one origin.
 */
const BASE_URL = "/api";

/** A failed request, in the only shape a caller has to handle. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /**
     * What was wrong, one problem at a time, when the failure was a refusal of
     * something submitted. Every one carries a path (DECISIONS #008), which is
     * how a form puts a sentence under the input it belongs to; empty for every
     * other kind of failure.
     */
    readonly details: readonly ValidationError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** What a write carries. Nothing else in this app sends a body. */
type Body = Record<string, unknown>;

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) throw await errorFrom(response);
    return (await response.json()) as T;
  },

  /**
   * Running an action, and creating a record. An action carries no body — which
   * record and which action are both in the address — and a create carries the
   * values the form was filled in with.
   */
  post: <T>(path: string, body?: Body): Promise<T> => send<T>("POST", path, body),

  /**
   * Correcting a record. `PATCH` rather than `PUT` because the form sends what
   * changed: a field the write leaves out keeps the value it has.
   */
  patch: <T>(path: string, body: Body): Promise<T> => send<T>("PATCH", path, body),
};

async function send<T>(method: string, path: string, body?: Body): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as T;
}

/**
 * Normalizes the API's `ErrorEnvelope`. Anything else — a proxy's HTML, a body
 * that never arrived — still becomes an ApiError.
 */
async function errorFrom(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!isErrorEnvelope(body)) {
    return new ApiError(response.status, "unexpected_error", `Request failed (${response.status})`);
  }
  return new ApiError(response.status, body.error.code, body.error.message, body.error.details ?? []);
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (typeof body !== "object" || body === null) return false;
  const error: unknown = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return false;
  const { code, message, details } = error as Record<string, unknown>;
  return (
    typeof code === "string" &&
    typeof message === "string" &&
    (details === undefined || Array.isArray(details))
  );
}
