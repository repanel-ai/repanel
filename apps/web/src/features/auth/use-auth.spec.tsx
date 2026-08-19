import type { LoginRequest, UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client";
import { authKeys, useAuth } from "./use-auth";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };
const PASSWORD = "correct-horse";

afterEach(() => vi.unstubAllGlobals());

describe("useAuth", () => {
  it("answers with nobody while nobody is signed in", async () => {
    const { result } = renderUseAuth(signedOut());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("reads the session back under the key the factory names, once signing in succeeds", async () => {
    const queryClient = testQueryClient();
    const { result } = renderUseAuth(signedOut(), queryClient);
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.login.mutate({ email: ADA.email, password: PASSWORD }));

    await waitFor(() => expect(result.current.user).toEqual(ADA));
    expect(queryClient.getQueryData(authKeys.me())).toEqual(ADA);
  });

  it("has the session in hand before it hands the page off", async () => {
    const queryClient = testQueryClient();
    const { result } = renderUseAuth(signedOut(), queryClient);
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // What the login page does on success is navigate to a guarded route. If the
    // session were still stale at that moment, RequireAuth would send it straight
    // back to /login.
    let sessionWhenHandedOff: unknown = "the handoff never happened";
    act(() =>
      result.current.login.mutate(
        { email: ADA.email, password: PASSWORD },
        {
          onSuccess: () => {
            sessionWhenHandedOff = queryClient.getQueryData(authKeys.me());
          },
        },
      ),
    );

    await waitFor(() => expect(sessionWhenHandedOff).toEqual(ADA));
  });

  it("surfaces the API's own words when the credentials are wrong", async () => {
    const { result } = renderUseAuth(signedOut());
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.login.mutate({ email: ADA.email, password: "wrong" }));

    await waitFor(() => expect(result.current.login.error).toBeInstanceOf(ApiError));
    expect(result.current.login.error?.message).toBe("Email or password is incorrect");
    expect(result.current.user).toBeNull();
  });

  it("gives the session up on signing out", async () => {
    const { result } = renderUseAuth({ user: ADA });
    await waitFor(() => expect(result.current.user).toEqual(ADA));

    act(() => result.current.logout.mutate());

    await waitFor(() => expect(result.current.user).toBeNull());
  });
});

function signedOut(): Session {
  return { user: null };
}

interface Session {
  user: UserDto | null;
}

/**
 * Stands in for the API, session and all: signing in makes `/auth/me` answer,
 * signing out makes it stop. Nothing about the cache is stubbed, so an
 * invalidation that never happens shows up as a stale answer.
 */
function stubApi(session: Session) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") {
        return session.user ? json(200, session.user) : unauthorized("Sign in to continue");
      }
      if (url === "/api/auth/login") {
        const { password } = JSON.parse(String(init?.body)) as LoginRequest;
        if (password !== PASSWORD) return unauthorized("Email or password is incorrect");
        session.user = ADA;
        return json(200, ADA);
      }
      if (url === "/api/auth/logout") {
        session.user = null;
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request: ${url}`);
    }),
  );
}

function renderUseAuth(session: Session, queryClient = testQueryClient()) {
  stubApi(session);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

/** No retries: a test that waits out a backoff is a test nobody runs. */
function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(message: string): Response {
  return json(401, { error: { code: "unauthorized", message } });
}
