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
  /**
   * A form's write is the one request this app sends a body with, and a
   * refusal of one is the one error it has somewhere specific to put: the
   * details name the field, so the sentence lands under the input.
   */
  it("sends a write as JSON", async () => {
    const fetched = stubFetch(json(200, { id: "u_9", values: {} }));

    await api.post("/runtime/acme/resources/users/records", { values: { name: "Ada" } });

    expect(fetched).toHaveBeenCalledWith("/api/runtime/acme/resources/users/records", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values: { name: "Ada" } }),
    });
  });

  it("corrects a record with PATCH, so what it leaves out is left alone", async () => {
    const fetched = stubFetch(json(200, { id: "u_1", values: {} }));

    await api.patch("/runtime/acme/resources/users/records/u_1", { values: { name: "Ada" } });

    expect(fetched).toHaveBeenCalledWith(
      "/api/runtime/acme/resources/users/records/u_1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("keeps the details a refusal carries, so a form can place each one", async () => {
    const detail = {
      path: "values.email",
      message: "`nope` is not an email address.",
      expected: "an email value",
      hint: "Send an email address such as `person@example.com` for `values.email`.",
    };
    stubFetch(
      json(422, { error: { code: "write_refused", message: "This write was refused.", details: [detail] } }),
    );

    const error = await api
      .post("/runtime/acme/resources/users/records", { values: {} })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual([detail]);
  });

  it("carries no details when the failure has none", async () => {
    stubFetch(json(500, { error: { code: "internal_error", message: "Internal server error" } }));

    const error = await api.get("/auth/me").catch((reason: unknown) => reason);

    expect((error as ApiError).details).toEqual([]);
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