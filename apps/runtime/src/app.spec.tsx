import type { UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";
import { adminDefinition } from "./features/runtime/definition.fixture";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("renders the admin for the project in the URL", async () => {
    renderAt("/a/skyscout/r/users", ADA);

    expect(await screen.findByText("Acme Admin")).toBeDefined();
    expect(screen.getByText("skyscout")).toBeDefined();
  });

  it("directs a visitor with no session to the console", async () => {
    renderAt("/a/skyscout", null);

    expect(await screen.findByRole("link", { name: "Sign in to RePanel" })).toBeDefined();
  });
});

function renderAt(path: string, user: UserDto | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      if (!user) {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "Sign in to continue" } }),
          { status: 401 },
        );
      }
      const url = String(input);
      const body = url.endsWith("/auth/me")
        ? user
        : url.endsWith("/definition")
          ? adminDefinition
          : { records: [], total: 0, page: 1, pageSize: 25 };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
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
