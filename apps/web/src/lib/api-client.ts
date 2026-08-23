import type { ErrorEnvelope, ValidationError } from "@repanel/contracts";

/**
 * Every request the console makes goes through here. The path is relative:
 * the dev server proxies /api to the API and strips the prefix, so the browser
 * only ever talks to one origin and the session cookie never leaves it.
 */
const BASE_URL = "/api";

/** A failed request, in the only shape a caller has to handle. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: readonly ValidationError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * What to put in front of a human when a request failed. The API's own words
 * whenever it had any — it writes them for the person reading them — and one
 * sentence of ours when the request never arrived to be answered.
 */
export function messageOf(error: Error | null | undefined): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "Could not reach RePanel. Try again.";
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, sending("POST", body)),

  put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, sending("PUT", body)),
};

/** A request with a body, or without one — a POST need not carry anything. */
function sending(method: string, body: unknown): RequestInit {
  if (body === undefined) return { method };
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { ...init, credentials: "include" });
  if (!response.ok) throw await errorFrom(response);
  return (await bodyOf(response)) as T;
}

/**
 * An empty body is how the API says there is nothing: `204` for "done", and a
 * bodiless `200` for a route that answers with null. Asking either for JSON
 * throws, so the text is read first and only parsed when there is some.
 */
async function bodyOf(response: Response): Promise<unknown> {
  const body = await response.text();
  return body === "" ? undefined : (JSON.parse(body) as unknown);
}

/**
 * Normalizes the API's `ErrorEnvelope`. Anything else — a proxy's HTML, a body
 * that never arrived — still becomes an ApiError: a caller made to tell those
 * apart has no way of doing it.
 */
async function errorFrom(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!isErrorEnvelope(body)) {
    return new ApiError(response.status, "unexpected_error", `Request failed (${response.status})`);
  }
  return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
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
