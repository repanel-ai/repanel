import type { ValidationError } from "@repanel/contracts";

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

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: "POST",
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }),
};

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { ...init, credentials: "include" });
  if (!response.ok) throw await errorFrom(response);
  return (await bodyOf(response)) as T;
}

/** 204 is how the API says "done"; asking it for JSON throws. */
async function bodyOf(response: Response): Promise<unknown> {
  return response.status === 204 ? undefined : await response.json();
}

/**
 * Normalizes the API's `{ error: { code, message, details } }`. Anything else —
 * a proxy's HTML, a body that never arrived — still becomes an ApiError: a
 * caller made to tell those apart has no way of doing it.
 */
async function errorFrom(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!isErrorBody(body)) {
    return new ApiError(response.status, "unexpected_error", `Request failed (${response.status})`);
  }
  return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: readonly ValidationError[];
  };
}

function isErrorBody(body: unknown): body is ErrorBody {
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
