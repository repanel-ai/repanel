import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api-client";

const ADA = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("addresses the API under /api and carries the session cookie", async () => {
    const fetched = stubFetch(json(200, ADA));

    await expect(api.get("/auth/me")).resolves.toEqual(ADA);
    expect(fetched).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });
  });

  it("normalizes the API's error body", async () => {
    stubFetch(json(401, { error: { code: "unauthorized", message: "Sign in to continue" } }));

    const error = await api.get("/auth/me").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "Sign in to continue",
    });
  });

  it("still fails as an ApiError when the body is not one", async () => {
    stubFetch(new Response("<html>Bad Gateway</html>", { status: 502 }));

    const error = await api.get("/auth/me").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      code: "unexpected_error",
      message: "Request failed (502)",
    });
  });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const fetched = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetched);
  return fetched;
}
