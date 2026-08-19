import type { UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("sends a visitor with no session to the login page", async () => {
    renderAt("/", null);

    expect(await screen.findByText("Sign in to RePanel")).toBeDefined();
  });

  it("lets a signed-in visitor through to the console", async () => {
    renderAt("/", ADA);

    expect(await screen.findByText(/Projects — built in task 014/)).toBeDefined();
  });
});

function renderAt(path: string, user: UserDto | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      user
        ? new Response(JSON.stringify(user), { status: 200 })
        : new Response(
            JSON.stringify({ error: { code: "unauthorized", message: "Sign in to continue" } }),
            { status: 401 },
          ),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
