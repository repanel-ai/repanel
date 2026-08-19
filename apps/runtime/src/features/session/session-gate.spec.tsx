import type { UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionGate } from "./session-gate";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };
const CONSOLE_URL = "https://console.repanel.test";

afterEach(() => vi.unstubAllGlobals());

describe("SessionGate", () => {
  it("shows the admin to whoever is signed in", async () => {
    renderGate(ADA);

    expect(await screen.findByText("Records")).toBeDefined();
  });

  it("directs everyone else to the console, which is where signing in happens", async () => {
    renderGate(null);

    const link = await screen.findByRole("link", { name: "Sign in to RePanel" });
    expect(link.getAttribute("href")).toBe(`${CONSOLE_URL}/login`);
    expect(screen.queryByText("Records")).toBeNull();
  });
});

function renderGate(user: UserDto | null) {
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
      <SessionGate consoleUrl={CONSOLE_URL}>
        <p>Records</p>
      </SessionGate>
    </QueryClientProvider>,
  );
}
