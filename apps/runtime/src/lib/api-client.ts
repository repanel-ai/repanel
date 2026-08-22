import type { ErrorEnvelope } from "@repanel/contracts";

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
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
   * No body, and no parameter for one: the only thing this app posts is an
   * action, and a v0 action carries no inputs — which record and which action
   * are both in the address.
   */
  post: async <T>(path: string): Promise<T> => {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw await errorFrom(response);
    return (await response.json()) as T;
  },
};

/**
 * Normalizes the API's `ErrorEnvelope`. Anything else — a proxy's HTML, a body
 * that never arrived — still becomes an ApiError. The renderer surfaces code
 * and message only; `details` belongs to the console, which is where a
 * definition is repaired.
 */
async function errorFrom(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!isErrorEnvelope(body)) {
    return new ApiError(response.status, "unexpected_error", `Request failed (${response.status})`);
  }
  return new ApiError(response.status, body.error.code, body.error.message);
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
