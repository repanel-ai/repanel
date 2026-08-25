import type { UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorizeCliPage } from "./authorize-cli-page";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("AuthorizeCliPage", () => {
  it("hands a minted session to the machine that asked, and nowhere else", async () => {
    const replace = vi.fn();
    renderAt("/cli?port=54321&state=s-1", replace);

    fireEvent.click(await screen.findByRole("button", { name: "Authorize" }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("http://127.0.0.1:54321/?state=s-1&token=cli-token"),
    );
  });

  it("offers nothing to authorize when the address did not come from the CLI", async () => {
    const replace = vi.fn();
    renderAt("/cli?port=evil.example.com&state=s-1", replace);

    expect(await screen.findByText(/not opened by the RePanel CLI/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Authorize" })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

function renderAt(path: string, replace: (url: string) => void) {
  vi.stubGlobal("location", { replace });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init?: RequestInit) => {
      if (input === "/api/auth/me") return Promise.resolve(json(ADA));
      if (input === "/api/auth/cli" && init?.method === "POST") {
        return Promise.resolve(json({ token: "cli-token" }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: "not_found", message: "Not found" } }), {
          status: 404,
        }),
      );
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthorizeCliPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
